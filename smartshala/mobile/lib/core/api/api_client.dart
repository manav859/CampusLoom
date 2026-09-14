import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:path_provider/path_provider.dart';

import '../auth/token_storage.dart';
import '../config/app_config.dart';
import 'api_exception.dart';

/// Every request is tenant-scoped: `{baseUrl}/{schoolCode}/api/v1/{path}`.
/// The school code comes from the login screen and is kept in secure storage,
/// because a mobile client — unlike the web dashboard — does not know its
/// tenant until the user names it.
class ApiClient {
  // Initializing formals cannot be used here: the fields are private and Dart
  // forbids private named parameters.
  ApiClient({
    required AppConfig config,
    required TokenStorage storage,
    @visibleForTesting HttpClientAdapter? httpClientAdapter,
  })
      // ignore: prefer_initializing_formals
      : _config = config,
        // ignore: prefer_initializing_formals
        _storage = storage {
    _dio = Dio(
      BaseOptions(
        // The hosted backend sleeps when idle and can take the better part of a
        // minute to answer the first request, so the receive budget has to
        // outlast a cold start or the app reports itself offline instead.
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
        headers: {'x-client-type': 'mobile'},
      ),
    );
    if (httpClientAdapter != null) _dio.httpClientAdapter = httpClientAdapter;

    _dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final AppConfig _config;
  final TokenStorage _storage;
  late final Dio _dio;

  String? _schoolCode;
  Completer<_RefreshResult>? _refreshInFlight;
  PersistCookieJar? _cookieJar;

  /// The server hands the refresh token to browsers as an httpOnly `ss_rt`
  /// cookie and reads it back from that cookie on /auth/refresh. Giving the app
  /// a cookie jar of its own means sessions survive an expired access token on
  /// exactly the mechanism the deployed backend already supports — a body
  /// token, when the server also returns one, is kept as a fallback.
  ///
  /// Must be awaited before the first request; the jar has to be on disk or the
  /// session would not outlive the process.
  Future<void> initCookieJar() async {
    if (_cookieJar != null) return;
    final directory = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(storage: FileStorage('${directory.path}/cookies'));
    _cookieJar = jar;
    _dio.interceptors.insert(0, CookieManager(jar));
  }

  /// Sign-out has to drop the refresh cookie too, or the next user on this
  /// device inherits the last one's session.
  Future<void> clearCookies() async => _cookieJar?.deleteAll();

  /// Called after a successful login and on app start when a session is restored.
  void useSchoolCode(String schoolCode) => _schoolCode = schoolCode.toUpperCase();

  String get _apiRoot {
    final code = _schoolCode;
    if (code == null || code.isEmpty) {
      throw ApiException(
        message: 'No school selected. Please sign in again.',
        code: 'SCHOOL_CODE_MISSING',
      );
    }
    return '${_config.apiBaseUrl}/$code/api/v1';
  }

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] != true) {
      final token = await _storage.readAccessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final isAuthCall = error.requestOptions.extra['skipAuth'] == true;
    final alreadyRetried = error.requestOptions.extra['retried'] == true;

    if (error.response?.statusCode != 401 || isAuthCall || alreadyRetried) {
      return handler.next(error);
    }

    final result = await _refreshAccessToken();
    final unreachable = result.unreachable;
    if (unreachable != null) {
      // Report the refresh's own failure, not the stale 401 — otherwise a
      // server that is merely asleep or out of signal reads as "signed out".
      return handler.next(
        DioException(
          requestOptions: error.requestOptions,
          type: unreachable.type,
          response: unreachable.response,
          error: unreachable.error,
          message: unreachable.message,
        ),
      );
    }
    if (!result.renewed) return handler.next(error);

    try {
      final options = error.requestOptions;
      options.extra['retried'] = true;

      // A FormData body is a one-shot stream: the first attempt consumes it, so
      // replaying the same instance would upload nothing. clone() rebuilds it
      // from the original fields and file handles.
      final body = options.data;
      if (body is FormData) options.data = body.clone();

      final token = await _storage.readAccessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';

      final response = await _dio.fetch<dynamic>(options);
      return handler.resolve(response);
    } on DioException catch (retryError) {
      return handler.next(retryError);
    }
  }

  /// Collapses parallel 401s into a single refresh call.
  Future<_RefreshResult> _refreshAccessToken() {
    final pending = _refreshInFlight;
    if (pending != null) return pending.future;

    final completer = Completer<_RefreshResult>();
    _refreshInFlight = completer;

    () async {
      try {
        // No stored token is not a dead end: the `ss_rt` cookie from login is
        // what the deployed backend actually reads, so the call is still worth
        // making. Only a server rejection ends the session.
        final refreshToken = await _storage.readRefreshToken();

        final response = await _dio.post<Map<String, dynamic>>(
          '$_apiRoot/auth/refresh',
          data: refreshToken == null ? null : {'refreshToken': refreshToken},
          options: Options(extra: {'skipAuth': true}),
        );

        final accessToken = response.data?['accessToken'] as String?;
        if (accessToken == null) {
          completer.complete(const _RefreshResult.rejected());
          return;
        }

        await _storage.saveAccessToken(accessToken);
        completer.complete(const _RefreshResult.renewed());
      } on DioException catch (failure) {
        // 401/403 is the server's verdict on the refresh token. No response, a
        // timeout, a 5xx while the host wakes up or a 429 is not a verdict.
        final status = failure.response?.statusCode;
        completer.complete(
          status == 401 || status == 403
              ? const _RefreshResult.rejected()
              : _RefreshResult.unreachable(failure),
        );
      } catch (_) {
        completer.complete(const _RefreshResult.rejected());
      } finally {
        _refreshInFlight = null;
      }
    }();

    return completer.future;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _dio.get<dynamic>('$_apiRoot$path', queryParameters: query));

  /// A binary download, such as a receipt PDF.
  Future<List<int>> getBytes(String path) async {
    final data = await _send(
      () => _dio.get<List<int>>('$_apiRoot$path', options: Options(responseType: ResponseType.bytes)),
    );
    return data as List<int>;
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    bool skipAuth = false,
    String? schoolCode,
    Map<String, String>? headers,
  }) =>
      _send(() {
        final root = schoolCode != null
            ? '${_config.apiBaseUrl}/${schoolCode.toUpperCase()}/api/v1'
            : _apiRoot;
        return _dio.post<dynamic>(
          '$root$path',
          data: body,
          options: Options(extra: {'skipAuth': skipAuth}, headers: headers),
        );
      });

  /// Multipart POST for the one endpoint that takes a file — the optional
  /// leave attachment. Every other field rides along as a form field, which is
  /// what the server's validator expects after multer has run.
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    required String fileField,
    required String filePath,
    required String fileName,
  }) =>
      _send(() async {
        final form = FormData.fromMap({
          ...fields,
          fileField: await MultipartFile.fromFile(filePath, filename: fileName),
        });
        return _dio.post<dynamic>('$_apiRoot$path', data: form);
      });

  Future<dynamic> patch(String path, {Object? body}) =>
      _send(() => _dio.patch<dynamic>('$_apiRoot$path', data: body));
  Future<dynamic> delete(String path) => _send(() => _dio.delete<dynamic>('$_apiRoot$path'));

  Future<dynamic> _send(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

/// How a refresh attempt ended. Only [rejected] means the session is over;
/// [unreachable] carries the failure of a refresh that never got an answer.
class _RefreshResult {
  const _RefreshResult.renewed()
      : renewed = true,
        unreachable = null;

  const _RefreshResult.rejected()
      : renewed = false,
        unreachable = null;

  const _RefreshResult.unreachable(DioException this.unreachable) : renewed = false;

  final bool renewed;
  final DioException? unreachable;
}
