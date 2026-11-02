// The "+" sheet used to be capped at 9/16 of the screen with no way to scroll,
// so on a short screen its last action was clipped and unreachable. These
// tests fail on the old sheet and pass on the scrollable one.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/principal/quick_add_sheet.dart';
import 'package:smartshala_mobile/features/teacher/teacher_more_sheet.dart';

/// A phone small enough that the sheet cannot show every action at once.
void _useShortScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 1440);
  tester.view.devicePixelRatio = 3;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

Future<void> _open(WidgetTester tester, Future<void> Function(BuildContext) show) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(onPressed: () => show(context), child: const Text('open')),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the principal + sheet scrolls to its last action', (tester) async {
    _useShortScreen(tester);
    await _open(tester, QuickAddSheet.show);

    // The first action is on screen; the last one is below the fold.
    expect(find.text('Add Student'), findsOneWidget);

    await tester.drag(find.byType(SingleChildScrollView).last, const Offset(0, -400));
    await tester.pumpAndSettle();

    final last = find.text('Create Event / Notice');
    expect(last, findsOneWidget);
    // Fully on screen, not clipped by the sheet's bottom edge.
    final box = tester.getRect(last);
    expect(box.bottom, lessThanOrEqualTo(tester.view.physicalSize.height / 3));
  });

  testWidgets('the teacher More sheet scrolls too', (tester) async {
    _useShortScreen(tester);
    await _open(tester, TeacherMoreSheet.show);

    expect(find.byType(SingleChildScrollView), findsWidgets);
    expect(find.text('More'), findsOneWidget);
  });
}
