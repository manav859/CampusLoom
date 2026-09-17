import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api/api_client.dart';
import 'core/app/smartshala_app.dart';
import 'core/config/app_config.dart';
import 'features/principal/data/principal_repository.dart';
import 'features/principal/principal_shell.dart';

/// Entry point for the SmartShala Principal app.
///   flutter run -t lib/main_principal.dart --flavor principal
void main() {
  runApp(
    SmartShalaApp(
      config: AppConfig.forFlavor(AppFlavor.principal),
      sessionProviders: [
        Provider<PrincipalRepository>(
          create: (context) => PrincipalRepository(context.read<ApiClient>()),
        ),
      ],
      shellBuilder: (_) => const PrincipalShell(),
    ),
  );
}
