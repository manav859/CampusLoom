import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/principal/data/quick_actions_store.dart';
import 'package:smartshala_mobile/features/principal/quick_actions_sheet.dart';

void main() {
  test('Home starts with the six of the blueprint', () {
    expect(QuickActionsStore.defaults, [
      QuickActionKey.students,
      QuickActionKey.teachers,
      QuickActionKey.attendance,
      QuickActionKey.fees,
      QuickActionKey.leave,
      QuickActionKey.notice,
    ]);
  });

  test('a keystore that will not answer still yields the defaults', () async {
    // There is no plugin behind flutter_secure_storage in a test, so this is
    // the real failure path rather than a stubbed one.
    expect(await QuickActionsStore().read(), QuickActionsStore.defaults);
  });

  test('hidden features are never offered', () {
    expect(QuickActionsStore.all.contains(QuickActionKey.payroll), isFalse,
        reason: 'Payroll is hidden behind kPayrollEnabled');
  });

  testWidgets('the sheet returns the new selection in grid order', (tester) async {
    List<QuickActionKey>? saved;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                saved = await QuickActionsSheet.show(
                  context,
                  selected: QuickActionsStore.defaults,
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // Add one that is not in the defaults, drop one that is.
    await tester.tap(find.text('Exams'));
    await tester.tap(find.text('Teachers'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(saved, [
      QuickActionKey.students,
      QuickActionKey.attendance,
      QuickActionKey.fees,
      QuickActionKey.leave,
      QuickActionKey.notice,
      QuickActionKey.exams,
    ]);
  });

  testWidgets('the last tile cannot be turned off', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => QuickActionsSheet.show(
                context,
                selected: const [QuickActionKey.students],
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Students'));
    await tester.pumpAndSettle();

    expect(find.text('Pick at least one'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
  });
}
