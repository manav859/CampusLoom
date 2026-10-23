import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../features/auth/login_screen.dart';
import '../api/api_client.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_repository.dart';
import '../auth/token_storage.dart';
import '../config/app_config.dart';
import '../data/messages_repository.dart';
import '../data/unread_controller.dart';
import '../push/push_messenger.dart';
import '../push/push_service.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_header.dart';
import '../widgets/responsive.dart';
import '../widgets/state_views.dart';

/// Shared root for both binaries. `shellBuilder` and `sessionProviders` are the
/// only differences: the principal app mounts the principal shell and
/// repository, the teacher app the teacher ones.
class SmartShalaApp extends StatelessWidget {
  const SmartShalaApp({
    super.key,
    required this.config,
    required this.shellBuilder,
    required this.sessionProviders,
    this.loginBuilder = _defaultLoginBuilder,
  });

  final AppConfig config;
  final WidgetBuilder shellBuilder;

  /// The sign-in screen shown while signed out. Principal and Teacher use the
  /// shared email/password [LoginScreen]; the Parent app passes its own
  /// mobile + admission-number screen.
  final WidgetBuilder loginBuilder;

  static Widget _defaultLoginBuilder(BuildContext _) => const LoginScreen();

  /// Mounted above the Navigator, so screens pushed as routes can read them
  /// too. Keyed by the signed-in user: a different user gets fresh ones.
  final List<SingleChildWidget> sessionProviders;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppConfig>.value(value: config),
        Provider<TokenStorage>(create: (_) => TokenStorage()),
        ProxyProvider<TokenStorage, ApiClient>(
          update: (_, storage, previous) =>
              previous ?? ApiClient(config: config, storage: storage),
        ),
        ProxyProvider<ApiClient, MessagesRepository>(
          update: (_, api, previous) => previous ?? MessagesRepository(api),
        ),
        ProxyProvider2<ApiClient, TokenStorage, AuthRepository>(
          update: (_, api, storage, previous) =>
              previous ?? AuthRepository(api: api, storage: storage),
        ),
        // Above AuthController, which starts and stops it with the session,
        // and above the Navigator, so a tapped notification still has
        // somewhere to publish itself while the shell is being built.
        ChangeNotifierProvider<PushService>(
          create: (context) => PushService(api: context.read<ApiClient>(), config: config),
        ),
        // PushService is read in create, not listed as a dependency: it is a
        // ChangeNotifier, and depending on it would rebuild this provider on
        // every notification that arrives.
        ChangeNotifierProxyProvider3<AuthRepository, TokenStorage, ApiClient, AuthController>(
          create: (context) => AuthController(
            config: config,
            repository: context.read<AuthRepository>(),
            storage: context.read<TokenStorage>(),
            api: context.read<ApiClient>(),
            push: context.read<PushService>(),
          )..restoreSession(),
          update: (_, __, ___, ____, previous) => previous!,
        ),
      ],
      child: MaterialApp(
        title: config.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.build(),
        builder: (context, child) => AppViewport(
          child: MultiProvider(
            key: ValueKey(context.select<AuthController, String?>((auth) => auth.user?.id)),
            providers: [
              ChangeNotifierProvider<UnreadController>(create: (_) => UnreadController()),
              ...sessionProviders,
            ],
            child: PushMessenger(child: child ?? const SizedBox.shrink()),
          ),
        ),
        home: _AuthGate(shellBuilder: shellBuilder, loginBuilder: loginBuilder),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate({required this.shellBuilder, required this.loginBuilder});

  final WidgetBuilder shellBuilder;
  final WidgetBuilder loginBuilder;

  @override
  Widget build(BuildContext context) {
    final status = context.select<AuthController, AuthStatus>((auth) => auth.status);

    return switch (status) {
      AuthStatus.checking => const _SplashScreen(),
      AuthStatus.signedOut => Builder(builder: loginBuilder),
      AuthStatus.signedIn => Builder(builder: shellBuilder),
      AuthStatus.unreachable => const _UnreachableScreen(),
    };
  }
}

/// Shown when a stored session could not be checked. The user stays signed
/// in — this is a "try again", never a way back to the login screen.
class _UnreachableScreen extends StatelessWidget {
  const _UnreachableScreen();

  @override
  Widget build(BuildContext context) {
    final reason = context.select<AuthController, String?>((auth) => auth.errorMessage);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _SplashLogo(),
              ErrorView(
                message: 'You are still signed in, but SmartShala could not be reached.'
                    '${reason == null ? '' : '\n$reason'}',
                onRetry: () => context.read<AuthController>().retryRestore(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _SplashLogo(),
            SizedBox(height: 24),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
          ],
        ),
      ),
    );
  }
}

class _SplashLogo extends StatelessWidget {
  const _SplashLogo();

  @override
  Widget build(BuildContext context) {
    return const BrandLogo(size: 72);
  }
}
