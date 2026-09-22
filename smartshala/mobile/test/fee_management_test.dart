import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/widgets/app_cards.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/fee_models.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/fees/defaulters_screen.dart';
import 'package:smartshala_mobile/features/principal/fees/fee_management_screen.dart';
import 'package:smartshala_mobile/features/principal/fees/record_payment_screen.dart';
import 'package:smartshala_mobile/features/principal/fees/student_fee_ledger_screen.dart';

const _nbsp = ' ';

DefaulterRow _defaulter(String name, String className, {double balance = 1000, int days = 0, String status = 'PENDING'}) =>
    DefaulterRow(studentId: 'id-$name', name: name, className: className, balance: balance, daysOverdue: days, status: status);

/// The shape GET /fees/students/:id/ledger returns (fees.service getStudentLedger).
Map<String, dynamic> _ledgerJson({double balance = 15000}) => {
      'student': {
        'id': 's1',
        'fullName': 'Aarav Mehta',
        'admissionNumber': 'ADM-2026-001',
        'class': {'id': 'c1', 'name': '6', 'section': 'A'},
      },
      'total': 30000,
      'paid': 30000 - balance,
      'balance': balance,
      'dueToDate': 20000,
      'currentOutstanding': 5000,
      'currentCollected': 15000,
      'upcomingDue': 10000,
      'status': 'PARTIAL',
      'assignments': [
        {
          'id': 'a1',
          'feeStructureId': 'f1',
          'transportFeeAmount': 6000,
          'total': 30000,
          'paid': 15000,
          'balance': 15000,
          'status': 'PARTIAL',
          'feeStructure': {'name': 'Annual Fee 2026-27', 'dueDate': '2026-04-10T00:00:00.000Z'},
        },
      ],
      'payments': [
        {
          'id': 'p1',
          'date': '2026-04-19T00:00:00.000Z',
          'paidAt': '2026-04-19T00:00:00.000Z',
          'amount': 15000,
          'feeComponent': 'SCHOOL_FEE',
          'mode': 'UPI',
          'upiTransactionId': '4132007890',
          'chequeNumber': null,
          'receiptId': 'r1',
          'receiptNo': 'REC-2026-00001',
          'receipt': {'id': 'r1', 'receiptNo': 'REC-2026-00001'},
          'feeStructureName': 'Annual Fee 2026-27',
          'balanceAfter': 15000,
        },
      ],
      'adjustments': [],
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  _FakeRepository({this.defaulterRows});

  /// Overrides the three-row default, for the long-list test.
  final List<DefaulterRow>? defaulterRows;

  final payments = <(NewPayment, String)>[];
  final reminders = <String>[];
  int ledgerCalls = 0;
  ApiException? paymentError;

  @override
  Future<FeesOverview> feesOverview() async => FeesOverview.fromJson({
        'totalDue': 1250000,
        'dueToDate': 800000,
        'totalCollected': 650000,
        'currentOutstanding': 150000,
        'totalPending': 600000,
        'defaulterCount': 21,
        'topDefaulters': [
          {
            'id': 'a1',
            'studentId': 's1',
            'paidAmount': '15000',
            'pendingAmount': '15000',
            'currentOutstanding': 5000,
            'status': 'PARTIAL',
            'student': {'id': 's1', 'fullName': 'Aarav Mehta', 'class': {'name': '6', 'section': 'A'}},
            'feeStructure': {'id': 'f1', 'name': 'Annual Fee 2026-27', 'totalAmount': '30000'},
          },
        ],
      });

  @override
  Future<List<DefaulterRow>> defaulters() async =>
      defaulterRows ??
      [
        _defaulter('Aarav Mehta', '6-A', balance: 15000, days: 45, status: 'PARTIAL'),
        _defaulter('Diya Rao', '7-B', balance: 8000, days: 3),
        _defaulter('Kabir Shah', '6-A', balance: 22000, days: 120, status: 'OVERDUE'),
      ];

  @override
  Future<List<FeeStructureRow>> feeStructures() async => [
        FeeStructureRow.fromJson({
          'id': 'f1',
          'name': 'Annual Fee 2026-27',
          'academicYear': '2026-27',
          'frequency': 'QUARTERLY',
          'totalAmount': '30000',
          'isActive': true,
          'class': null,
        }),
      ];

  @override
  Future<FeeLedger> feeLedger(String studentId) async {
    ledgerCalls++;
    return FeeLedger.fromJson(_ledgerJson());
  }

  @override
  Future<PaymentReceipt> recordPayment(NewPayment payment, {required String idempotencyKey}) async {
    payments.add((payment, idempotencyKey));
    final error = paymentError;
    if (error != null) throw error;
    return PaymentReceipt.fromJson({
      'payment': {'amount': payment.amount},
      'receipt': {'id': 'r2', 'receiptNo': 'REC-2026-00002'},
      'ledger': {'total': 30000, 'paid': 20000, 'balance': 10000, 'status': 'PARTIAL'},
      'receiptNotificationQueued': true,
    });
  }

  @override
  Future<void> sendFeeReminder(DefaulterRow row) async => reminders.add(row.name);
}

Future<_FakeRepository> _pump(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1, _FakeRepository? repository}) async {
  tester.view.physicalSize = Size(width * 2, 7000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repo = repository ?? _FakeRepository();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repo,
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  group('Fee rules ported from the web', () {
    test('the reminder text matches the web defaulter queue word for word', () {
      expect(
        feeReminderMessage(studentName: 'Aarav Mehta', balance: 15000),
        'Dear Parent, fee balance of ₹${_nbsp}15,000 for Aarav Mehta is pending. Please clear it at the earliest.',
      );
    });

    test('aging buckets split by days overdue at 30, 60 and 90', () {
      final rows = [for (final days in [0, 30, 31, 60, 61, 90, 91, 400]) _defaulter('n$days', '6-A', days: days)];
      expect(agingBuckets(rows).map((bucket) => '${bucket.label}:${bucket.value}'), ['0-30:2', '31-60:2', '61-90:2', '90+:2']);
    });

    test('defaulter filters combine and the default sort is longest overdue, then balance', () {
      final rows = [
        _defaulter('A', '6-A', balance: 100, days: 10),
        _defaulter('B', '6-A', balance: 900, days: 10),
        _defaulter('C', '7-B', balance: 500, days: 40, status: 'PARTIAL'),
        _defaulter('D', '6-A', balance: 50, days: 0),
      ];
      expect(filterDefaulters(rows).map((row) => row.name), ['C', 'B', 'A', 'D']);
      expect(filterDefaulters(rows, className: '6-A', dueAge: DueAge.month).map((row) => row.name), ['B', 'A']);
      expect(filterDefaulters(rows, dueAge: DueAge.current).map((row) => row.name), ['D']);
      expect(filterDefaulters(rows, status: 'PARTIAL').map((row) => row.name), ['C']);
      expect(filterDefaulters(rows, search: '7-b').map((row) => row.name), ['C']);
      expect(filterDefaulters(rows, sort: DefaulterSort.balanceAsc).map((row) => row.name), ['D', 'A', 'C', 'B']);
    });

    test('a payment needs a positive amount within the balance and its mode’s reference', () {
      expect(validatePayment(amount: null, balance: 100, mode: PaymentMode.cash), 'Enter an amount greater than zero.');
      expect(validatePayment(amount: 150, balance: 100, mode: PaymentMode.cash), 'Amount cannot exceed ₹${_nbsp}100.');
      expect(
        validatePayment(amount: 50, balance: 100, mode: PaymentMode.upi, reference: ' '),
        'UPI Transaction ID is required for UPI payments.',
      );
      expect(
        validatePayment(amount: 50, balance: 100, mode: PaymentMode.bankTransfer),
        'Bank Reference is required for Bank Transfer payments.',
      );
      expect(validatePayment(amount: 100, balance: 100, mode: PaymentMode.cheque, reference: '006421'), isNull);
    });

    test('the payment body carries the reference only under its mode’s field', () {
      final body = NewPayment(
        studentId: 's1',
        amount: 5000,
        mode: PaymentMode.cheque,
        paidOn: DateTime(2026, 9, 4),
        reference: ' 006421 ',
        isTransport: true,
      ).toJson();
      expect(body, {
        'studentId': 's1',
        'amount': 5000.0,
        'feeComponent': 'TRANSPORTATION_FEE',
        'mode': 'CHEQUE',
        'paidAt': '2026-09-04',
        'sendReceiptOnWhatsApp': true,
        'chequeNumber': '006421',
      });
      expect(
        NewPayment(studentId: 's1', amount: 1, mode: PaymentMode.cash, paidOn: DateTime(2026, 1, 1), reference: 'x').toJson().keys,
        isNot(contains('upiTransactionId')),
      );
    });

    test('idempotency keys are v4 UUIDs the server’s pattern accepts', () {
      final pattern = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
      final random = Random(7);
      final keys = {for (var i = 0; i < 50; i++) newIdempotencyKey(random)};
      expect(keys, hasLength(50));
      expect(keys.every(pattern.hasMatch), isTrue);
    });

    test('the ledger reads the server’s shape, including the payment reference and receipt', () {
      final ledger = FeeLedger.fromJson(_ledgerJson());
      expect(ledger.className, '6-A');
      expect(ledger.assignments.single.baseFee, 24000);
      final payment = ledger.payments.single;
      expect(payment.reference, '4132007890');
      expect(payment.receiptId, 'r1');
      expect(payment.receiptNo, 'REC-2026-00001');
      expect(payment.componentLabel, 'School fee');
    });
  });

  group('Fee Management', () {
    testWidgets('shows the web’s six KPI cards, the aging buckets and the accounts', (tester) async {
      await _pump(tester, const FeeManagementScreen());
      for (final label in ['Total Assigned', 'Due to Date', 'Total Collection', 'Current Outstanding', 'Outstanding', 'Defaulters']) {
        expect(find.text(label), findsWidgets);
      }
      expect(find.text('₹${_nbsp}12.5 Lakh'), findsOneWidget);
      expect(find.text('31-60 DAYS'), findsOneWidget);
      expect(find.text('Annual Fee 2026-27 - 6-A'), findsOneWidget);
      expect(find.text('Record Payment'), findsOneWidget);
    });

    testWidgets('lays out at 320dp with 1.3x text and at 1200dp', (tester) async {
      await _pump(tester, const FeeManagementScreen(), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
      await _pump(tester, const FeeManagementScreen(), width: 1200);
      expect(tester.takeException(), isNull);
    });
  });

  group('Defaulters', () {
    testWidgets('filters by class and sends a reminder for the row tapped', (tester) async {
      final repo = await _pump(tester, const DefaultersScreen());
      expect(find.text('Showing 3 of 3 pending active fee accounts.'), findsOneWidget);

      await tester.tap(find.text('All Classes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7-B').last);
      await tester.pumpAndSettle();
      expect(find.text('Showing 1 of 3 pending active fee accounts.'), findsOneWidget);

      await tester.tap(find.text('Send WhatsApp'));
      await tester.pumpAndSettle();
      expect(repo.reminders, ['Diya Rao']);
      expect(find.text('WhatsApp reminder sent to Diya Rao.'), findsOneWidget);
    });

    testWidgets('lays out at 320dp with 1.3x text', (tester) async {
      await _pump(tester, const DefaultersScreen(), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a school-sized list builds only the rows on screen', (tester) async {
      // The server returns every pending account at once, so this list is as
      // long as the school. It must not build a card per student up front.
      await _pump(
        tester,
        const DefaultersScreen(),
        repository: _FakeRepository(
          defaulterRows: [
            for (var index = 0; index < 400; index++)
              _defaulter('Student $index', '6-A', balance: 1000 + index.toDouble()),
          ],
        ),
      );

      // The default sort is longest overdue then largest balance, so the
      // highest-numbered student leads and Student 0 is 400 rows down.
      expect(find.text('Showing 400 of 400 pending active fee accounts.'), findsOneWidget);
      expect(find.text('Student 399'), findsOneWidget);
      expect(find.text('Student 0'), findsNothing);
      expect(
        tester.widgetList(find.byType(AppCard)).length,
        lessThan(200),
        reason: 'an eager ListView would have built all 400 cards',
      );
    });
  });

  group('Record Payment', () {
    Future<void> enter(WidgetTester tester, String label, String text) async {
      await tester.enterText(find.widgetWithText(TextField, label), text);
      await tester.pump();
    }

    testWidgets('names the missing reference and never calls the API', (tester) async {
      final repo = await _pump(tester, const RecordPaymentScreen(studentId: 's1', studentName: 'Aarav Mehta', balance: 15000));
      await enter(tester, 'Amount', '20000');
      await tester.tap(find.widgetWithText(FilledButton, 'Record Payment'));
      await tester.pumpAndSettle();
      expect(find.text('Amount cannot exceed ₹${_nbsp}15,000.'), findsOneWidget);

      await enter(tester, 'Amount', '5000');
      await tester.tap(find.text('Cash'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('UPI').last);
      await tester.pumpAndSettle();
      expect(find.text('Balance after payment'), findsOneWidget);
      expect(find.text('₹${_nbsp}10,000'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Record Payment'));
      await tester.pumpAndSettle();
      expect(find.text('UPI Transaction ID is required for UPI payments.'), findsOneWidget);
      expect(repo.payments, isEmpty);
    });

    testWidgets('a retry after a failure reuses the same idempotency key', (tester) async {
      final repo = _FakeRepository()
        ..paymentError = ApiException(message: 'The server took too long to respond. Please try again.', code: 'TIMEOUT');
      await _pump(tester, const RecordPaymentScreen(studentId: 's1', studentName: 'Aarav Mehta', balance: 15000), repository: repo);
      await enter(tester, 'Amount', '5000');

      await tester.tap(find.widgetWithText(FilledButton, 'Record Payment'));
      await tester.pumpAndSettle();
      expect(find.text('The server took too long to respond. Please try again.'), findsOneWidget);

      repo.paymentError = null;
      await tester.tap(find.widgetWithText(FilledButton, 'Record Payment'));
      await tester.pumpAndSettle();

      expect(repo.payments, hasLength(2));
      expect(repo.payments[0].$2, repo.payments[1].$2);
      expect(repo.payments[1].$1.amount, 5000);
      expect(repo.payments[1].$1.mode, PaymentMode.cash);
    });
  });

  group('Fee ledger', () {
    testWidgets('records a payment, reloads the ledger and shows the receipt', (tester) async {
      final repo = await _pump(tester, const StudentFeeLedgerScreen(studentId: 's1'));
      expect(find.textContaining('Receipt REC-2026-00001'), findsOneWidget);
      expect(find.textContaining('Ref 4132007890'), findsOneWidget);
      expect(find.textContaining('Transportation fee: ₹${_nbsp}6,000'), findsOneWidget);

      await tester.tap(find.text('Record Payment'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Amount'), '5000');
      await tester.tap(find.widgetWithText(FilledButton, 'Record Payment'));
      await tester.pumpAndSettle();

      expect(repo.payments.single.$1.studentId, 's1');
      expect(repo.ledgerCalls, 2);
      expect(find.text('Payment Recorded'), findsOneWidget);
      expect(find.text('REC-2026-00002'), findsOneWidget);
      expect(find.text('WhatsApp receipt sent or queued for parent'), findsOneWidget);
    });

    testWidgets('lays out at 320dp with 1.3x text', (tester) async {
      await _pump(tester, const StudentFeeLedgerScreen(studentId: 's1'), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
    });
  });
}
