import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../config/app_config.dart';
import 'app_user.dart';
import 'auth_repository.dart';
import 'token_storage.dart';

/// [unreachable]: a session is stored but could not be checked because the
/// server did not answer. The session is kept; the user can retry.
enum AuthStatus { checking, signedOut, signedIn, unreachable }

class AuthController extends ChangeNotifier {
  AuthController({
    required this.config,
    required this.repository,
    required this.storage,
    required this.api,
  });

  final AppConfig config;
  final AuthRepository repository;
  final TokenStorage storage;
  final ApiClient api;

  AuthStatus status = AuthStatus.checking;
  AppUser? user;
  String? schoolCode;
  String? errorMessage;
  bool isSubmitting = false;

  /// Restores a session on cold start. A stored token is trusted only after
  /// /auth/me confirms the account is still active and still the right role.
  Future<void> restoreSession() async {
    // Nothing may hit the network before the refresh cookie is loaded off disk,
    // or a returning user's session cannot be renewed. This runs before the
    // login screen is reachable, so login is covered too.
    await api.initCookieJar();

    final storedCode = await storage.readSchoolCode();
    schoolCode = storedCode;

    final token = await storage.readAccessToken();
    if (storedCode == null || token == null) {
      _set(AuthStatus.signedOut);
      return;
    }

    api.useSchoolCode(storedCode);
    try {
      final me = await repository.me();
      if (!_roleAllowed(me)) {
        await repository.logout();
        errorMessage = _wrongPortalMessage(me.role);
        _set(AuthStatus.signedOut);
        return;
      }
      user = me;
      _set(AuthStatus.signedIn);
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        // The server's verdict: the refresh token was refused or the account
        // is no longer active. Only this ends a stored session.
        await storage.clearSession();
        _set(AuthStatus.signedOut);
        return;
      }

      // Offline, a timeout while the hosted API wakes up, a 5xx — none of
      // these say anything about the session, so it is kept for a retry.
      errorMessage = error.message;
      _set(AuthStatus.unreachable);
    }
  }

  /// Checks the stored session again after [AuthStatus.unreachable].
  Future<void> retryRestore() async {
    errorMessage = null;
    _set(AuthStatus.checking);
    await restoreSession();
  }

  Future<bool> login({
    required String schoolCodeInput,
    required String identifier,
    required String password,
  }) async {
    isSubmitting = true;
    errorMessage = null;
    notifyListeners();

    try {
      final signedIn = await repository.login(
        schoolCode: schoolCodeInput.trim().toUpperCase(),
        identifier: identifier,
        password: password,
      );

      if (!_roleAllowed(signedIn)) {
        await repository.logout();
        errorMessage = _wrongPortalMessage(signedIn.role);
        isSubmitting = false;
        notifyListeners();
        return false;
      }

      user = signedIn;
      schoolCode = schoolCodeInput.trim().toUpperCase();
      isSubmitting = false;
      _set(AuthStatus.signedIn);
      return true;
    } on ApiException catch (error) {
      errorMessage = error.message;
      isSubmitting = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await repository.logout();
    user = null;
    errorMessage = null;
    _set(AuthStatus.signedOut);
  }

  bool _roleAllowed(AppUser candidate) => config.allowedRoles.contains(candidate.role);

  String _wrongPortalMessage(String role) {
    final target = config.isPrincipal ? 'SmartShala Teacher' : 'SmartShala Principal';
    return 'This account is a ${_roleLabel(role)} account. Please use the $target app.';
  }

  String _roleLabel(String role) => switch (role) {
        'PRINCIPAL' => 'principal',
        'ADMIN' => 'admin',
        'TEACHER' => 'teacher',
        'ACCOUNTANT' => 'accountant',
        'PARENT' => 'parent',
        _ => role.toLowerCase(),
      };

  void _set(AuthStatus next) {
    status = next;
    notifyListeners();
  }
}
