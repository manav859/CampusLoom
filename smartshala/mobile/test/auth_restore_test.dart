import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/api/api_client.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/auth/app_user.dart';
import 'package:smartshala_mobile/core/auth/auth_controller.dart';
import 'package:smartshala_mobile/core/auth/auth_repository.dart';
import 'package:smartshala_mobile/core/auth/token_storage.dart';
import 'package:smartshala_mobile/core/config/app_config.dart';

/// Reopening the app must not sign a teacher out because the server was slow,
/// asleep or out of reach. Only the server refusing the session (401) may.
class _Storage extends Fake implements TokenStorage {
  int cleared = 0;

  @override
  Future<String?> readSchoolCode() async => 'SS000001';

  @override
  Future<String?> readAccessToken() async => cleared == 0 ? 'stored-token' : null;

  @override
  Future<void> clearSession() async => cleared++;
}

class _Api extends Fake implements ApiClient {
  @override
  Future<void> initCookieJar() async {}

  @override
  void useSchoolCode(String schoolCode) {}
}

/// One reply per /auth/me call: an [AppUser] to return or an [ApiException]
/// to throw, in order.
class _Repository extends Fake implements AuthRepository {
  _Repository(this.replies);

  final List<Object> replies;

  @override
  Future<AppUser> me() async {
    final reply = replies.removeAt(0);
    if (reply is ApiException) throw reply;
    return reply as AppUser;
  }
}

const _teacher = AppUser(
  id: 'user-1',
  fullName: 'Asha Menon',
  role: 'TEACHER',
  schoolName: 'Demo School',
);

AuthController _controller(_Storage storage, List<Object> replies) => AuthController(
      config: AppConfig.forFlavor(AppFlavor.teacher),
      repository: _Repository(replies),
      storage: storage,
      api: _Api(),
    );

void main() {
  test('a timeout keeps the session, and a retry signs straight back in', () async {
    final storage = _Storage();
    final auth = _controller(storage, [
      ApiException(message: 'The server took too long to respond.', code: 'TIMEOUT'),
      _teacher,
    ]);

    await auth.restoreSession();
    expect(auth.status, AuthStatus.unreachable);
    expect(storage.cleared, 0, reason: 'a slow server is not a sign-out');

    await auth.retryRestore();
    expect(auth.status, AuthStatus.signedIn);
    expect(auth.user?.fullName, 'Asha Menon');
  });

  test('no network and a 5xx keep the session too', () async {
    for (final failure in [
      ApiException(message: 'Cannot reach SmartShala.', code: 'NETWORK_ERROR'),
      ApiException(message: 'Bad gateway', code: 'APP_ERROR', statusCode: 502),
    ]) {
      final storage = _Storage();
      final auth = _controller(storage, [failure]);

      await auth.restoreSession();
      expect(auth.status, AuthStatus.unreachable, reason: failure.code);
      expect(storage.cleared, 0, reason: failure.code);
    }
  });

  test('a 401 is the server ending the session, so it is cleared', () async {
    final storage = _Storage();
    final auth = _controller(storage, [
      ApiException(message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN', statusCode: 401),
    ]);

    await auth.restoreSession();
    expect(auth.status, AuthStatus.signedOut);
    expect(storage.cleared, 1);
  });
}
