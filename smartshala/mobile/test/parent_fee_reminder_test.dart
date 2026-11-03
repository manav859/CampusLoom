// A fee-reminder message in the parent Messages feed carries a "Pay fees"
// button that opens the Fees tab; an ordinary message does not.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_announcements_screen.dart';

class _Repository extends Fake implements ParentRepository {
  _Repository(this._messages);
  final List<ParentMessage> _messages;

  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async =>
      const AnnouncementPage(items: [], total: 0, unreadCount: 0, hasMore: false);

  @override
  Future<List<ParentMessage>> childMessages(String childId) async => _messages;
}

Future<int> _pump(WidgetTester tester, List<ParentMessage> messages) async {
  tester.view.physicalSize = const Size(1200, 4000);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);

  var feesOpened = 0;
  await tester.pumpWidget(
    Provider<ParentRepository>.value(
      value: _Repository(messages),
      child: MaterialApp(
        home: Scaffold(
          body: ParentAnnouncementsScreen(
            child: const ParentChild(id: 'a', fullName: 'Aarav Sharma', className: '5-A'),
            onOpenFees: () => feesOpened++,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  // Returned via closure capture below.
  _feesOpened = () => feesOpened;
  return feesOpened;
}

late int Function() _feesOpened;

ParentMessage _message(String type) => ParentMessage(
      id: 'm-$type',
      body: 'A fee payment is pending for Aarav.',
      type: type,
      sentAt: DateTime(2026, 11, 3, 10),
    );

void main() {
  testWidgets('a fee reminder shows Pay fees, which opens the Fees tab', (tester) async {
    await _pump(tester, [_message('FEE_REMINDER')]);

    final payButton = find.widgetWithText(FilledButton, 'Pay fees');
    expect(payButton, findsOneWidget);

    await tester.tap(payButton);
    await tester.pump();
    expect(_feesOpened(), 1);
  });

  testWidgets('an ordinary message has no Pay fees button', (tester) async {
    await _pump(tester, [_message('HOMEWORK_REMINDER')]);

    expect(find.widgetWithText(FilledButton, 'Pay fees'), findsNothing);
    expect(find.text('From school'), findsOneWidget);
  });
}
