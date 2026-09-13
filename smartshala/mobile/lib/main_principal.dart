import 'package:flutter/material.dart';

import 'core/app/smartshala_app.dart';
import 'core/config/app_config.dart';
import 'features/principal/principal_shell.dart';

/// Entry point for the SmartShala Principal app.
///   flutter run -t lib/main_principal.dart --flavor principal
void main() {
  runApp(
    SmartShalaApp(
      config: AppConfig.forFlavor(AppFlavor.principal),
      shellBuilder: (_) => const PrincipalShell(),
    ),
  );
}
