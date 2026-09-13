import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'app_user.dart';
import 'token_storage.dart';

class AuthRepository {
  AuthRepository({required this.api, required this.storage});

  final ApiClient api;
  final TokenStorage storage;

  /// The school code is part of the URL, so it is validated by the same call
  /// that checks the credentials — a wrong code fails before any password work.
  Future<AppUser> login({
    required String schoolCode,
    required String identifier,
    required String password,
  }) async {
    final data = await api.post(
      '/auth/login',
      body: {'identifier': identifier.trim(), 'password': password},
      skipAuth: true,
      schoolCode: schoolCode,
    ) as Map<String, dynamic>;

    final accessToken = data['accessToken'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;

    if (accessToken == null || userJson == null) {
      throw ApiException(message: 'Unexpected response from server.', code: 'BAD_RESPONSE');
    }

    await storage.saveSession(
      accessToken: accessToken,
      refreshToken: data['refreshToken'] as String?,
      schoolCode: schoolCode,
    );
    api.useSchoolCode(schoolCode);

    return AppUser.fromJson(userJson);
  }

  Future<AppUser> me() async {
    final data = await api.get('/auth/me') as Map<String, dynamic>;
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } on ApiException {
      // A failed server call must not trap the user in a signed-in shell.
    } finally {
      await storage.clearSession();
      await api.clearCookies();
    }
  }

  Future<void> forgotPassword({required String schoolCode, required String identifier}) =>
      api.post(
        '/auth/forgot-password',
        body: {'identifier': identifier.trim()},
        skipAuth: true,
        schoolCode: schoolCode,
      );
}
