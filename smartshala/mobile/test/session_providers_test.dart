import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/app/smartshala_app.dart';
import 'package:smartshala_mobile/core/config/app_config.dart';

class _PathProvider extends PathProviderPlatform with MockPlatformInterfaceMixin {
  _PathProvider(this.path);

  final String path;

  @override
  Future<String?> getApplicationSupportPath() async => path;
}

class _SessionThing {
  const _SessionThing();
}

/// Screens are pushed as routes, and a route sits under the Navigator, not
/// under the shell. A repository provided around the shell was invisible to
/// every pushed screen on a real device (School Profile showed "Unable to
/// load"), while widget tests, which put providers above MaterialApp, passed.
void main() {
  late Directory support;

  setUp(() {
    support = Directory.systemTemp.createTempSync('smartshala_test');
    PathProviderPlatform.instance = _PathProvider(support.path);
    FlutterSecureStorage.setMockInitialValues({});
  });

  tearDown(() => support.deleteSync(recursive: true));

  testWidgets('a pushed route can read the session providers', (tester) async {
    await tester.runAsync(() async {
      await tester.pumpWidget(SmartShalaApp(
        config: AppConfig.forFlavor(AppFlavor.principal),
        sessionProviders: [Provider<_SessionThing>.value(value: const _SessionThing())],
        shellBuilder: (_) => const SizedBox(),
      ));
      await Future<void>.delayed(const Duration(milliseconds: 200));
    });
    await tester.pump();

    _SessionThing? read;
    tester.state<NavigatorState>(find.byType(Navigator)).push(MaterialPageRoute<void>(
      builder: (context) {
        read = context.read<_SessionThing>();
        return const SizedBox();
      },
    ));
    await tester.pumpAndSettle();

    expect(read, isNotNull);
  });
}
