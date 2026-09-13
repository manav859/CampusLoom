/// Which portal this binary is. The two apps share everything in `core/` and
/// differ only in the feature tree they mount after login.
enum AppFlavor { principal, teacher }

class AppConfig {
  const AppConfig({required this.flavor, required this.apiBaseUrl});

  final AppFlavor flavor;
  final String apiBaseUrl;

  /// The deployed backend the web dashboard also talks to. Defaulting to it
  /// means an installed app works on any device without a dev server running;
  /// point at a local one only when you are actually changing the API:
  ///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
  static const productionBaseUrl = 'https://smartshala-backend.onrender.com';

  static const _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: productionBaseUrl,
  );

  /// True when the app is talking to something other than the deployed
  /// backend — surfaced on the login screen so a local build is never mistaken
  /// for the real thing.
  bool get isUsingCustomBackend => apiBaseUrl != productionBaseUrl;

  factory AppConfig.forFlavor(AppFlavor flavor) =>
      AppConfig(flavor: flavor, apiBaseUrl: _defaultBaseUrl);

  bool get isPrincipal => flavor == AppFlavor.principal;
  bool get isTeacher => flavor == AppFlavor.teacher;

  String get appName => isPrincipal ? 'SmartShala Principal' : 'SmartShala Teacher';
  String get portalLabel => isPrincipal ? 'PRINCIPAL APP' : 'TEACHER PORTAL';

  /// Roles allowed to sign in to this binary. The server enforces permissions
  /// per endpoint; this only keeps a teacher out of the principal app's shell.
  List<String> get allowedRoles =>
      isPrincipal ? const ['PRINCIPAL', 'ADMIN'] : const ['TEACHER'];
}
