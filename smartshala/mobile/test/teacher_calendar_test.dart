import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/teacher/calendar/teacher_calendar_screen.dart';
import 'package:smartshala_mobile/features/teacher/data/calendar_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';

/// Serves the same three items for whichever month the screen asks for, and
/// records which months were requested.
class _FakeRepository extends Fake implements TeacherRepository {
  final requested = <DateTime>[];

  @override
  Future<List<CalendarEvent>> calendarMonth(DateTime month) async {
    requested.add(month);
    DateTime day(int date) => DateTime(month.year, month.month, date);

    return [
      CalendarEvent(
        id: 'holiday',
        type: CalendarEventType.holiday,
        title: 'Founders Day',
        startDate: day(10),
        endDate: day(10),
      ),
      CalendarEvent(
        id: 'exam',
        type: CalendarEventType.exam,
        title: 'Unit Test 2',
        startDate: day(14),
        endDate: day(18),
      ),
      CalendarEvent(
        id: 'meeting',
        type: CalendarEventType.meeting,
        title: 'Parent Teacher Meeting',
        startDate: day(25),
        endDate: day(25),
      ),
    ];
  }
}

final _now = DateTime.now();

Future<_FakeRepository> _pump(WidgetTester tester) async {
  // Tall enough that the whole event list is laid out without scrolling.
  tester.view.physicalSize = const Size(1080, 3200);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);

  final repository = _FakeRepository();
  await tester.pumpWidget(
    MaterialApp(
      home: Provider<TeacherRepository>.value(
        value: repository,
        child: const TeacherCalendarScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return repository;
}

Finder _day(int date) => find.byKey(
      ValueKey(
        'calendar-day-${DateFormat('yyyy-MM-dd').format(DateTime(_now.year, _now.month, date))}',
      ),
    );

void main() {
  testWidgets('opens on the current month and lists its events and holidays', (tester) async {
    final repository = await _pump(tester);

    expect(repository.requested, [DateTime(_now.year, _now.month)]);
    expect(find.text('Founders Day'), findsOneWidget);
    expect(find.text('Unit Test 2'), findsOneWidget);
    expect(find.text('Parent Teacher Meeting'), findsOneWidget);
  });

  testWidgets('a legend entry hides its type and a second tap restores it', (tester) async {
    await _pump(tester);

    await tester.tap(find.text('Exams'));
    await tester.pump();
    expect(find.text('Unit Test 2'), findsNothing);
    expect(find.text('Founders Day'), findsOneWidget, reason: 'other types are untouched');

    await tester.tap(find.text('Exams'));
    await tester.pump();
    expect(find.text('Unit Test 2'), findsOneWidget);
  });

  testWidgets('a day inside a multi-day event narrows the list to that event', (tester) async {
    await _pump(tester);

    await tester.tap(_day(16));
    await tester.pump();
    expect(find.text('Unit Test 2'), findsOneWidget, reason: '16th falls within 14th–18th');
    expect(find.text('Founders Day'), findsNothing);
    expect(find.text('Parent Teacher Meeting'), findsNothing);

    // Tapping the same day again goes back to the whole month.
    await tester.tap(_day(16));
    await tester.pump();
    expect(find.text('Founders Day'), findsOneWidget);
  });

  testWidgets('next month requests that month and drops the day selection', (tester) async {
    final repository = await _pump(tester);

    await tester.tap(_day(25));
    await tester.pump();
    expect(find.text('Founders Day'), findsNothing);

    await tester.tap(find.byTooltip('Next month'));
    await tester.pumpAndSettle();

    expect(repository.requested.last, DateTime(_now.year, _now.month + 1));
    expect(find.text('Founders Day'), findsOneWidget, reason: 'the day filter does not carry over');
  });
}
