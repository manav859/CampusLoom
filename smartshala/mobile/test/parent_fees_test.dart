import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_fees_screen.dart';

class _FakeParentRepository extends Fake implements ParentRepository {
  @override
  Future<ChildFees> fees(String childId) async => ChildFees(
        total: 12000,
        paid: 7000,
        balance: 5000,
        status: 'PARTIAL',
        assignments: const [
          FeeAssignment(
            id: 'fa1',
            name: 'Term 1 Fees',
            total: 12000,
            paid: 7000,
            pending: 5000,
            status: 'PARTIAL',
            payable: true,
          ),
        ],
        payments: [
          FeePayment(
            paymentId: 'p1',
            amount: 7000,
            paidAt: DateTime(2026, 7, 10),
            mode: 'ONLINE_GATEWAY',
            receiptId: 'r1',
            receiptNo: 'REC-2026-00001',
            feeStructureName: 'Term 1 Fees',
          ),
        ],
      );
}

const _child = ParentChild(id: 'a', fullName: 'Aarav Sharma');

Widget _wrap(Widget child) => Provider<ParentRepository>.value(
      value: _FakeParentRepository(),
      child: MaterialApp(home: Scaffold(body: child)),
    );

void main() {
  testWidgets('fees shows the outstanding balance, a payable fee and a receipt', (tester) async {
    await tester.pumpWidget(_wrap(const ParentFeesScreen(child: _child)));
    await tester.pumpAndSettle();

    // Summary balance.
    expect(find.text('Total outstanding'), findsOneWidget);
    expect(find.text('₹5,000'), findsWidgets);

    // The payable assignment surfaces a Pay button.
    expect(find.text('Term 1 Fees'), findsWidgets);
    expect(find.textContaining('Pay ₹5,000'), findsOneWidget);

    // A past payment with a downloadable receipt.
    expect(find.text('Payment history'), findsOneWidget);
    expect(find.text('₹7,000'), findsWidgets);
    expect(find.byIcon(Icons.download_rounded), findsOneWidget);
  });
}
