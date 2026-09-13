import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/teacher/data/salary_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/salary/salary_screen.dart';

/// A GET /payroll/me/slips body, shaped exactly as the backend returns it.
const _slipsJson = {
  'items': [
    {
      'id': 's2',
      'userId': 'u1',
      'month': '2026-09',
      'basicPay': 31000,
      'allowances': 0,
      'deductions': 0,
      'netPay': 31000,
      'status': 'PENDING',
      'paidOn': null,
      'note': null,
    },
    {
      'id': 's1',
      'userId': 'u1',
      'month': '2026-08',
      'basicPay': 30000,
      'allowances': 4500.5,
      'deductions': 1800,
      'netPay': 32700.5,
      'status': 'PAID',
      'paidOn': '2026-09-01',
      'note': 'Bank transfer',
    },
  ],
  'summary': {'paidThisYear': 32700.5, 'year': 2026},
};

class _FakeRepository extends Fake implements TeacherRepository {
  _FakeRepository(this.json);

  final Map<String, dynamic> json;

  @override
  Future<MySalary> mySalary() async => MySalary.fromJson(json);
}

Future<void> _pump(WidgetTester tester, Map<String, dynamic> json, {double width = 390, double textScale = 1.0}) async {
  tester.view.physicalSize = Size(width * 2, 3000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(
    MaterialApp(
      home: Provider<TeacherRepository>.value(
        value: _FakeRepository(json),
        child: const SalaryScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('parses slips and the yearly total', () {
    final salary = MySalary.fromJson(_slipsJson);
    expect(salary.latest?.month, '2026-09');
    expect(salary.latest?.isPaid, isFalse);
    expect(salary.slips.last.netPay, 32700.5);
    expect(salary.slips.last.paidOn, '2026-09-01');
    expect(salary.paidThisYear, 32700.5);
  });

  test('formats whole rupees without paise and keeps paise when present', () {
    expect(formatRupees(31000), '₹31,000');
    expect(formatRupees(32700.5), '₹32,700.50');
  });

  testWidgets('shows the latest slip, the paid total and every slip', (tester) async {
    await _pump(tester, _slipsJson);

    expect(find.text('Latest slip · September 2026'), findsOneWidget);
    expect(find.text('Paid in 2026'), findsOneWidget);
    expect(find.text('₹32,700.50'), findsNWidgets(2), reason: 'the paid total and the August row');
    expect(find.text('August 2026'), findsOneWidget);
    expect(find.text('Paid 1 Sep'), findsOneWidget);
    expect(find.text('Pending'), findsNWidgets(2), reason: 'on the latest card and its row');
  });

  testWidgets('tapping a slip opens its breakdown with the note', (tester) async {
    await _pump(tester, _slipsJson);

    await tester.tap(find.text('August 2026'));
    await tester.pumpAndSettle();

    expect(find.text('August 2026'), findsNWidgets(2));
    expect(find.text('− ₹1,800'), findsOneWidget);
    expect(find.text('+ ₹4,500.50'), findsOneWidget);
    expect(find.text('Note: Bank transfer'), findsOneWidget);
  });

  // A layout overflow fails a widget test, so this passing proves the rows fit.
  testWidgets('fits a small phone with large text', (tester) async {
    await _pump(tester, _slipsJson, width: 320, textScale: 1.3);
    expect(find.text('August 2026'), findsOneWidget);
  });

  testWidgets('says so when the school has recorded nothing yet', (tester) async {
    await _pump(tester, const {'items': [], 'summary': {'paidThisYear': 0, 'year': 2026}});
    expect(find.text('No salary slips yet'), findsOneWidget);
  });
}
