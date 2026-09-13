import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/api/api_client.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/auth/token_storage.dart';
import 'package:smartshala_mobile/core/config/app_config.dart';

/// An expired access token triggers a refresh. Only the server refusing that
/// refresh may surface as a 401 — a refresh that never got an answer must look
/// like the network problem it is, or the app treats it as a sign-out.
class _Storage extends Fake implements TokenStorage {
  String accessToken = 'expired';

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => 'refresh-token';

  @override
  Future<void> saveAccessToken(String value) async => accessToken = value;
}

/// Answers /auth/me with 401 until it sees the fresh token, and /auth/refresh
/// however the test decides.
class _Server implements HttpClientAdapter {
  _Server(this.onRefresh);

  final Future<ResponseBody> Function(RequestOptions options) onRefresh;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.uri.path.endsWith('/auth/refresh')) return onRefresh(options);

    return options.headers['Authorization'] == 'Bearer fresh'
        ? _json(200, {
            'user': {'id': 'user-1'},
          })
        : _json(401, {
            'error': {'code': 'AUTH_REQUIRED', 'message': 'Access token expired'},
          });
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

ApiClient _client(_Storage storage, _Server server) => ApiClient(
      config: AppConfig.forFlavor(AppFlavor.teacher),
      storage: storage,
      httpClientAdapter: server,
    )..useSchoolCode('SS000001');

Matcher _apiError({required String code, required bool unauthorized}) => throwsA(
      isA<ApiException>()
          .having((error) => error.code, 'code', code)
          .having((error) => error.isUnauthorized, 'isUnauthorized', unauthorized),
    );

void main() {
  test('a refresh that cannot reach the server reports offline, not a 401', () async {
    final server = _Server(
      (options) async => throw DioException.connectionError(requestOptions: options, reason: 'no route'),
    );

    await expectLater(
      _client(_Storage(), server).get('/auth/me'),
      _apiError(code: 'NETWORK_ERROR', unauthorized: false),
    );
  });

  test('a 5xx from the refresh while the host wakes up is not a 401', () async {
    final server = _Server(
      (_) async => _json(503, {
        'error': {'code': 'SERVICE_UNAVAILABLE', 'message': 'Waking up'},
      }),
    );

    await expectLater(
      _client(_Storage(), server).get('/auth/me'),
      _apiError(code: 'SERVICE_UNAVAILABLE', unauthorized: false),
    );
  });

  test('a refused refresh token surfaces as a 401', () async {
    final server = _Server(
      (_) async => _json(401, {
        'error': {'code': 'INVALID_REFRESH_TOKEN', 'message': 'Invalid refresh token'},
      }),
    );

    await expectLater(
      _client(_Storage(), server).get('/auth/me'),
      _apiError(code: 'AUTH_REQUIRED', unauthorized: true),
    );
  });

  test('a successful refresh stores the new token and retries the call', () async {
    final storage = _Storage();
    final server = _Server((_) async => _json(200, {'accessToken': 'fresh'}));

    final data = await _client(storage, server).get('/auth/me') as Map<String, dynamic>;
    expect(data['user'], {'id': 'user-1'});
    expect(storage.accessToken, 'fresh');
  });
}
