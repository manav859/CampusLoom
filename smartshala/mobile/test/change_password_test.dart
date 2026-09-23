import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/auth/auth_repository.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/auth/change_password_screen.dart';

class _FakeAuthRepository extends Fake implements AuthRepository {
  final calls = <(String, String)>[];
  bool wrongCurrent = false;

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    calls.add((currentPassword, newPassword));
    if (wrongCurrent) {
      throw ApiException(message: 'Incorrect current password', code: 'INVALID_CREDENTIALS', statusCode: 401);
    }
  }
}

Future<_FakeAuthRepository> _pump(WidgetTester tester, {double width = 390, double textScale = 1}) async {
  tester.view.physicalSize = Size(width * 2, 2400);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repository = _FakeAuthRepository();
  await tester.pumpWidget(
    Provider<AuthRepository>.value(
      value: repository,
      child: MaterialApp(
        builder: (context, child) => AppViewport(child: child),
        // A screen underneath, so a successful save has somewhere to pop to.
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen()),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return repository;
}

Future<void> _fill(WidgetTester tester, {required String current, required String next, required String confirm}) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(0), current);
  await tester.enterText(fields.at(1), next);
  await tester.enterText(fields.at(2), confirm);
  await tester.tap(find.text('Update Password'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('names every invalid field before calling the API', (tester) async {
    final repository = await _pump(tester);

    await _fill(tester, current: '', next: 'short', confirm: 'other');
    expect(find.text('Enter your current password'), findsOneWidget);
    expect(find.text('Use 8 to 72 characters'), findsOneWidget);
    expect(find.text('The passwords do not match'), findsOneWidget);

    await _fill(tester, current: 'SmartShala@123', next: 'SmartShala@123', confirm: 'SmartShala@123');
    expect(find.text('Choose a password different from the current one'), findsOneWidget);
    expect(repository.calls, isEmpty);
  });

  testWidgets('saves, says so and closes', (tester) async {
    final repository = await _pump(tester);

    await _fill(tester, current: 'SmartShala@123', next: 'NewSecret#2026', confirm: 'NewSecret#2026');
    expect(repository.calls, [('SmartShala@123', 'NewSecret#2026')]);
    expect(find.byType(ChangePasswordScreen), findsNothing);
    expect(find.text('Password updated.'), findsOneWidget);
  });

  testWidgets('a wrong current password shows the server message and stays open', (tester) async {
    final repository = await _pump(tester)..wrongCurrent = true;

    await _fill(tester, current: 'guess', next: 'NewSecret#2026', confirm: 'NewSecret#2026');
    expect(find.text('Incorrect current password'), findsOneWidget);
    expect(find.byType(ChangePasswordScreen), findsOneWidget);
    expect(repository.calls, hasLength(1));
  });

  testWidgets('fits a small phone with large text', (tester) async {
    await _pump(tester, width: 320, textScale: 1.3);
    expect(find.text('Update Password'), findsOneWidget);
  });
}
