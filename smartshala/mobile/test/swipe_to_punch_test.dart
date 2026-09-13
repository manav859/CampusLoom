import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/teacher/widgets/swipe_to_punch.dart';

/// The blueprint is explicit: punching is a swipe, never a tap circle. These
/// tests pin that behaviour down.
///
/// The chevron hint animation repeats forever, so these use explicit pumps
/// rather than `pumpAndSettle`, which would never settle.
void main() {
  Future<void> pumpBar(
    WidgetTester tester, {
    required Future<void> Function() onConfirmed,
    PunchAction action = PunchAction.punchIn,
    String? completedLabel,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 320,
              child: SwipeToPunch(
                action: action,
                completedLabel: completedLabel,
                onConfirmed: onConfirmed,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Long enough for the spring-back and completion animations to finish.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  final handle = find.byIcon(Icons.keyboard_double_arrow_right_rounded);

  /// A real swipe arrives as many small moves, not one jump.
  Future<void> swipe(WidgetTester tester, double distance) async {
    final gesture = await tester.startGesture(tester.getCenter(handle));
    const steps = 12;
    for (var i = 0; i < steps; i++) {
      await gesture.moveBy(Offset(distance / steps, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await tester.pump();
  }

  testWidgets('tapping the handle never punches', (tester) async {
    var confirmations = 0;
    await pumpBar(tester, onConfirmed: () async => confirmations++);

    await tester.tap(handle);
    await settle(tester);

    expect(confirmations, 0, reason: 'a tap must not trigger a punch');
  });

  testWidgets('a short drag springs back without punching', (tester) async {
    var confirmations = 0;
    await pumpBar(tester, onConfirmed: () async => confirmations++);

    // Roughly a third of the track — well under the completion threshold.
    await swipe(tester, 90);
    await settle(tester);

    expect(confirmations, 0, reason: 'an incomplete swipe must not punch');
  });

  testWidgets('a full drag across the track punches once', (tester) async {
    var confirmations = 0;
    await pumpBar(tester, onConfirmed: () async => confirmations++);

    await swipe(tester, 320);
    await settle(tester);

    expect(confirmations, 1, reason: 'a completed swipe punches exactly once');
  });

  testWidgets('renders the punch-out prompt once punched in', (tester) async {
    await pumpBar(tester, onConfirmed: () async {}, action: PunchAction.punchOut);
    await tester.pump();

    expect(find.text('Swipe To Punch Out'), findsOneWidget);
    expect(find.text('Swipe To Punch In'), findsNothing);
  });

  testWidgets('a completed day is inert', (tester) async {
    var confirmations = 0;
    await pumpBar(
      tester,
      action: PunchAction.punchOut,
      completedLabel: "Today's punch complete",
      onConfirmed: () async => confirmations++,
    );
    await tester.pump();

    expect(find.text("Today's punch complete"), findsOneWidget);
    expect(handle, findsNothing, reason: 'a finished day exposes no drag handle');

    await tester.drag(find.byType(SwipeToPunch), const Offset(320, 0));
    await settle(tester);

    expect(confirmations, 0);
  });
}
