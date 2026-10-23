import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api/api_client.dart';
import 'core/app/smartshala_app.dart';
import 'core/config/app_config.dart';
import 'features/parent/data/parent_repository.dart';
import 'features/parent/data/parent_session.dart';
import 'features/parent/parent_login_screen.dart';
import 'features/parent/parent_shell.dart';

/// Entry point for the SmartShala Parent app.
///   flutter run -t lib/main_parent.dart --flavor parent
void main() {
  runApp(
    SmartShalaApp(
      config: AppConfig.forFlavor(AppFlavor.parent),
      loginBuilder: (_) => const ParentLoginScreen(),
      sessionProviders: [
        Provider<ParentRepository>(
          create: (context) => ParentRepository(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<ParentSession>(
          create: (context) => ParentSession(context.read<ParentRepository>()),
        ),
      ],
      shellBuilder: (_) => const ParentShell(),
    ),
  );
}
