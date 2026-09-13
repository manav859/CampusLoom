import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tokens and the tenant's school code live in the device keystore, never in
/// plain shared preferences.
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'ss_access_token';
  static const _refreshTokenKey = 'ss_refresh_token';
  static const _schoolCodeKey = 'ss_school_code';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readSchoolCode() => _storage.read(key: _schoolCodeKey);

  Future<void> saveSession({
    required String accessToken,
    String? refreshToken,
    required String schoolCode,
  }) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: accessToken),
      _storage.write(key: _schoolCodeKey, value: schoolCode),
      if (refreshToken != null) _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  Future<void> saveAccessToken(String accessToken) =>
      _storage.write(key: _accessTokenKey, value: accessToken);

  /// The school code survives sign-out so the next login screen can prefill it.
  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }
}
