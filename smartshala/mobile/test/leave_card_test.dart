import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/widgets/leave_card.dart';

/// The server returns 409 for a second decision on the same request, so the
/// card must never offer Approve / Reject on a row that is already decided.
LeaveRequest _request(LeaveStatus status) => LeaveRequest(
      id: 'leave-1',
      type: LeaveType.sick,
      status: status,
      fromDate: DateTime(2026, 9, 10),
      toDate: DateTime(2026, 9, 12),
      days: 3,
      reason: 'Fever, advised rest by the doctor.',
      appliedOn: DateTime(2026, 9, 9, 10, 30),
      applicantId: 'user-1',
      applicantName: 'Asha Menon',
      decidedByName: status == LeaveStatus.pending ? null : 'Head of School',
    );

Future<void> _pump(WidgetTester tester, Widget card) => tester.pumpWidget(
      MaterialApp(home: Scaffold(body: SingleChildScrollView(child: card))),
    );

void main() {
  testWidgets('a pending request offers Approve and Reject', (tester) async {
    var approved = 0;
    var rejected = 0;

    await _pump(
      tester,
      LeaveCard(
        request: _request(LeaveStatus.pending),
        showApplicant: true,
        onApprove: () => approved++,
        onReject: () => rejected++,
      ),
    );

    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Reject'), findsOneWidget);

    await tester.tap(find.text('Approve'));
    await tester.tap(find.text('Reject'));
    expect(approved, 1);
    expect(rejected, 1);
  });

  testWidgets('an approved request offers no decision buttons', (tester) async {
    await _pump(
      tester,
      LeaveCard(
        request: _request(LeaveStatus.approved),
        showApplicant: true,
        onApprove: () => fail('an approved request must not be decidable again'),
        onReject: () => fail('an approved request must not be decidable again'),
      ),
    );

    expect(find.text('Approve'), findsNothing);
    expect(find.text('Reject'), findsNothing);
    expect(find.text('Approved'), findsOneWidget);
    expect(find.textContaining('Approved by Head of School'), findsOneWidget);
  });

  testWidgets('busy disables the buttons so a decision cannot be double-sent', (tester) async {
    await _pump(
      tester,
      LeaveCard(
        request: _request(LeaveStatus.pending),
        showApplicant: true,
        busy: true,
        onApprove: () => fail('a busy card must not fire again'),
        onReject: () => fail('a busy card must not fire again'),
      ),
    );

    await tester.tap(find.text('Approve'), warnIfMissed: false);
    await tester.tap(find.text('Reject'), warnIfMissed: false);
    await tester.pump();
  });

  testWidgets('the teacher build shows Withdraw and hides the applicant name', (tester) async {
    var withdrawn = 0;

    await _pump(
      tester,
      LeaveCard(
        request: _request(LeaveStatus.pending),
        onWithdraw: () => withdrawn++,
      ),
    );

    expect(find.text('Asha Menon'), findsNothing);
    expect(find.text('Sick Leave'), findsOneWidget);
    expect(find.text('Approve'), findsNothing);

    await tester.tap(find.text('Withdraw'));
    expect(withdrawn, 1);
  });
}
