import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/principal/data/payroll_models.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/payroll/payroll_screen.dart';

/// GET /payroll/calculate, shaped as the backend returns it.
Map<String, dynamic> _monthJson(String month) => {
      'month': month,
      'workingDays': 25,
      'fullDayShare': 0.75,
      'items': [
        {
          'user': {'id': 'p1', 'fullName': 'Principal Rao', 'role': 'PRINCIPAL'},
          'shift': null,
          'monthlySalary': null,
          'dayRate': 0,
          'days': {'full': 20},
          'deductionDays': 0,
          'calculatedPay': null,
          'slip': null,
          'canEdit': false,
        },
        {
          'user': {'id': 't1', 'fullName': 'Asha Verma', 'role': 'TEACHER'},
          'shift': {'id': 's1', 'name': 'Morning', 'startTime': '09:00', 'endTime': '15:00', 'minutes': 360},
          'monthlySalary': 30000,
          'dayRate': 1200,
          'days': {'full': 3, 'half': 1, 'leave': 1, 'unpaidLeave': 1, 'absent': 19, 'missingPunchOut': 1},
          'deductionDays': 20.5,
          'calculatedPay': 5400,
          'slip': {'id': 'x', 'status': 'PENDING', 'netPay': 5400},
          'canEdit': true,
        },
        {
          'user': {'id': 't2', 'fullName': 'Bala Iyer', 'role': 'TEACHER'},
          'shift': null,
          'monthlySalary': null,
          'dayRate': 0,
          'days': {'full': 4},
          'deductionDays': 0,
          'calculatedPay': null,
          'slip': null,
          'canEdit': true,
        },
      ],
      'summary': {'totalCalculated': 5400},
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  final months = <String>[];
  final generated = <String>[];
  final profiles = <(String, double, String?)>[];

  @override
  Future<PayrollMonth> payrollMonth(String month) async {
    months.add(month);
    return PayrollMonth.fromJson(_monthJson(month));
  }

  @override
  Future<GenerateResult> generatePayslips(String month) async {
    generated.add(month);
    return const GenerateResult(generated: 1, skippedPaid: 0, skippedNoSalary: 1);
  }

  @override
  Future<List<StaffShift>> shifts() async => const [
        StaffShift(id: 's1', name: 'Morning', startTime: '09:00', endTime: '15:00', minutes: 360, staffCount: 1),
      ];

  @override
  Future<void> savePayProfile(String userId, {required double monthlySalary, String? shiftId}) async =>
      profiles.add((userId, monthlySalary, shiftId));
}

Future<_FakeRepository> _pump(WidgetTester tester, {double width = 390, double textScale = 1}) async {
  tester.view.physicalSize = Size(width * 2, 3200);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repository = _FakeRepository();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repository,
      child: const MaterialApp(home: PayrollScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return repository;
}

void main() {
  testWidgets('shows each staff member\'s pay worked out from attendance', (tester) async {
    await _pump(tester);
    expect(find.text('Asha Verma'), findsOneWidget);
    expect(find.text('Teacher • Morning, 9:00 AM – 3:00 PM'), findsOneWidget);
    expect(find.textContaining('5,400'), findsWidgets);
    expect(find.text('19 absent'), findsOneWidget);
    expect(find.text('1 half'), findsOneWidget);
    expect(find.text('1 unpaid leave'), findsOneWidget);
    expect(find.text('1 day without a punch-out, counted in full.'), findsOneWidget);
    expect(find.text('Slip pending'), findsOneWidget);
    expect(find.text('No salary set — tap to set one.'), findsOneWidget, reason: 'Bala has no salary yet');
    expect(find.text('Your own pay is set by another admin.'), findsOneWidget);
    expect(find.text('1 of 3'), findsOneWidget, reason: 'salaries set');
  });

  testWidgets('generates the month\'s pay slips after confirming', (tester) async {
    final repository = await _pump(tester);
    await tester.tap(find.textContaining('Generate pay slips for'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Generate'));
    await tester.pumpAndSettle();
    expect(repository.generated, hasLength(1));
    expect(find.textContaining('1 pay slip ready'), findsOneWidget);
  });

  testWidgets('sets a salary and shift for a teacher', (tester) async {
    final repository = await _pump(tester);
    await tester.tap(find.text('No salary set — tap to set one.'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '28000');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(repository.profiles, [('t2', 28000.0, null)]);
  });

  testWidgets('moves between months', (tester) async {
    final repository = await _pump(tester);
    await tester.tap(find.byTooltip('Previous month'));
    await tester.pumpAndSettle();
    expect(repository.months, hasLength(2));
    expect(repository.months.first, isNot(repository.months.last));
  });

  testWidgets('lists shifts', (tester) async {
    await _pump(tester);
    await tester.tap(find.text('Shifts'));
    await tester.pumpAndSettle();
    expect(find.text('Morning'), findsOneWidget);
    expect(find.text('9:00 AM – 3:00 PM • 6h • 1 staff'), findsOneWidget);
  });

  testWidgets('lays out at 320dp with 1.3x text', (tester) async {
    await _pump(tester, width: 320, textScale: 1.3);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Shifts'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
