import 'package:flutter/foundation.dart' show kDebugMode;

/// Which portal this binary is. The apps share everything in `core/` and
/// differ only in the feature tree they mount after login.
enum AppFlavor { principal, teacher, parent }

class AppConfig {
  const AppConfig({required this.flavor, required this.apiBaseUrl});

  final AppFlavor flavor;
  final String apiBaseUrl;

  /// The production backend on the VPS, the same origin the web dashboard is
  /// served from.
  static const productionBaseUrl = 'https://app.letssmartshala.com';

  static const _override = String.fromEnvironment('API_BASE_URL');

  /// A shipped app always talks to production. The override exists so the API
  /// can be worked on against a local server:
  ///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
  /// and it is honoured in debug builds only — a release APK that one rebuild
  /// flag could aim at somebody's laptop is not something to hand to a school.
  /// Both are const, so in a release build the override is not even compiled
  /// in. Profile builds are locked too; only a debug build can be redirected.
  static const _defaultBaseUrl =
      kDebugMode && _override != '' ? _override : productionBaseUrl;

  /// True when the app is talking to something other than the deployed
  /// backend — surfaced on the login screen so a local build is never mistaken
  /// for the real thing.
  bool get isUsingCustomBackend => apiBaseUrl != productionBaseUrl;

  factory AppConfig.forFlavor(AppFlavor flavor) =>
      AppConfig(flavor: flavor, apiBaseUrl: _defaultBaseUrl);

  bool get isPrincipal => flavor == AppFlavor.principal;
  bool get isTeacher => flavor == AppFlavor.teacher;
  bool get isParent => flavor == AppFlavor.parent;

  String get appName => switch (flavor) {
        AppFlavor.principal => 'SmartShala Principal',
        AppFlavor.teacher => 'SmartShala Teacher',
        AppFlavor.parent => 'SmartShala Parent',
      };

  String get portalLabel => switch (flavor) {
        AppFlavor.principal => 'PRINCIPAL APP',
        AppFlavor.teacher => 'TEACHER PORTAL',
        AppFlavor.parent => 'PARENT APP',
      };

  /// Roles allowed to sign in to this binary. The server enforces permissions
  /// per endpoint; this only keeps a teacher out of the principal app's shell.
  List<String> get allowedRoles => switch (flavor) {
        AppFlavor.principal => const ['PRINCIPAL', 'ADMIN'],
        AppFlavor.teacher => const ['TEACHER'],
        AppFlavor.parent => const ['PARENT'],
      };
}
