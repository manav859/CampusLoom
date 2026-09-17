import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api/api_client.dart';
import 'core/app/smartshala_app.dart';
import 'core/config/app_config.dart';
import 'features/teacher/data/punch_controller.dart';
import 'features/teacher/data/teacher_repository.dart';
import 'features/teacher/teacher_shell.dart';

/// Entry point for the SmartShala Teacher app.
///   flutter run -t lib/main_teacher.dart --flavor teacher
void main() {
  runApp(
    SmartShalaApp(
      config: AppConfig.forFlavor(AppFlavor.teacher),
      sessionProviders: [
        Provider<TeacherRepository>(
          create: (context) => TeacherRepository(context.read<ApiClient>()),
        ),
        ChangeNotifierProvider<PunchController>(
          create: (context) => PunchController(context.read<TeacherRepository>()),
        ),
      ],
      shellBuilder: (_) => const TeacherShell(),
    ),
  );
}
