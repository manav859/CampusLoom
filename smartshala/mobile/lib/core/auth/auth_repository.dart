import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'app_user.dart';
import 'token_storage.dart';

class AuthRepository {
  AuthRepository({required this.api, required this.storage});

  final ApiClient api;
  final TokenStorage storage;

  /// Signing in needs nothing but the credentials: the server searches the
  /// active tenants for the identifier and returns the school it belongs to as
  /// `tenantSchoolId`. Every call after this one is scoped to that code.
  Future<AppUser> login({
    required String identifier,
    required String password,
  }) async {
    final data = await api.post(
      '/auth/login',
      body: {'identifier': identifier.trim(), 'password': password},
      skipAuth: true,
      tenantScoped: false,
    ) as Map<String, dynamic>;

    final accessToken = data['accessToken'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;

    if (accessToken == null || userJson == null) {
      throw ApiException(message: 'Unexpected response from server.', code: 'BAD_RESPONSE');
    }

    final user = AppUser.fromJson(userJson);
    if (user.tenantSchoolId.isEmpty) {
      // Without it nothing after this request can be addressed, and failing
      // here says so plainly rather than at the first screen that loads.
      throw ApiException(
        message: 'Your account is not attached to a school. Ask your school to check it.',
        code: 'TENANT_MISSING',
      );
    }

    await storage.saveSession(
      accessToken: accessToken,
      refreshToken: data['refreshToken'] as String?,
      schoolCode: user.tenantSchoolId,
    );
    api.useSchoolCode(user.tenantSchoolId);

    return user;
  }

  /// Parents sign in with their mobile number and a child's admission (SR)
  /// number. Like staff login, the server finds the school and returns its code
  /// as `tenantSchoolId`; every call after this is scoped to it.
  Future<AppUser> parentLogin({
    required String mobile,
    required String admissionNumber,
  }) async {
    final data = await api.post(
      '/auth/parent/login',
      body: {'mobile': mobile.trim(), 'admissionNumber': admissionNumber.trim()},
      skipAuth: true,
      tenantScoped: false,
    ) as Map<String, dynamic>;

    final accessToken = data['accessToken'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;

    if (accessToken == null || userJson == null) {
      throw ApiException(message: 'Unexpected response from server.', code: 'BAD_RESPONSE');
    }

    final user = AppUser.fromJson(userJson);
    if (user.tenantSchoolId.isEmpty) {
      throw ApiException(
        message: 'Your account is not attached to a school. Ask your school to check it.',
        code: 'TENANT_MISSING',
      );
    }

    await storage.saveSession(
      accessToken: accessToken,
      refreshToken: data['refreshToken'] as String?,
      schoolCode: user.tenantSchoolId,
    );
    api.useSchoolCode(user.tenantSchoolId);

    return user;
  }

  Future<AppUser> me() async {
    final data = await api.get('/auth/me') as Map<String, dynamic>;
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      // Naming the session lets the server end just this device's, not the
      // same account's sessions on the web or another phone.
      final refreshToken = await storage.readRefreshToken();
      await api.post('/auth/logout', body: refreshToken == null ? null : {'refreshToken': refreshToken});
    } on ApiException {
      // A failed server call must not trap the user in a signed-in shell.
    } finally {
      await storage.clearSession();
      await api.clearCookies();
    }
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) => api.patch(
        '/auth/me/password',
        body: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );

  Future<void> forgotPassword({required String identifier}) => api.post(
        '/auth/forgot-password',
        body: {'identifier': identifier.trim()},
        skipAuth: true,
        tenantScoped: false,
      );
}
