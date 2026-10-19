import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/teacher/calendar/teacher_calendar_screen.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';

/// Serves the same three items for whichever month the screen asks for, and
/// records which months were requested. The punch history covers one day of
/// the month, so the same fake exercises a day worked and a day not worked.
class _FakeRepository extends Fake implements TeacherRepository {
  final requested = <DateTime>[];

  /// The day of the month the fake teacher punched on.
  static const punchedDay = 12;

  @override
  Future<List<DayActivity>> attendanceMonth(DateTime month) async {
    DateTime at(int hour, int minute) =>
        DateTime(month.year, month.month, punchedDay, hour, minute);

    return [
      DayActivity(
        date: DateTime(month.year, month.month, punchedDay),
        stamps: [
          DayStamp(kind: DayStampKind.punchIn, at: at(9, 2)),
          DayStamp(kind: DayStampKind.onBreak, at: at(13, 0), until: at(13, 30)),
          DayStamp(kind: DayStampKind.punchOut, at: at(16, 45)),
        ],
      ),
    ];
  }

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
  test('a day of punches drops the breaks that took no time', () {
    final day = DayActivity.fromJson({
      'date': '2026-10-12',
      'punchInAt': '2026-10-12T09:02:00',
      'punchOutAt': '2026-10-12T16:45:00',
      'breaks': [
        {'startAt': '2026-10-12T13:00:00', 'endAt': '2026-10-12T13:30:00', 'minutes': 30},
        // Ended and punched straight back in.
        {'startAt': '2026-10-12T14:03:00', 'endAt': '2026-10-12T14:03:00', 'minutes': 0},
      ],
    });

    expect(day.date, DateTime(2026, 10, 12));
    expect(
      day.stamps.map((stamp) => stamp.kind),
      [DayStampKind.punchIn, DayStampKind.onBreak, DayStampKind.punchOut],
      reason: 'in the order they happened, without the empty break',
    );
    expect(day.stamps[1].until, DateTime(2026, 10, 12, 13, 30));
  });

  test('a break nobody came back from is kept, with no end', () {
    final day = DayActivity.fromJson({
      'date': '2026-10-12',
      'punchInAt': '2026-10-12T09:02:00',
      'punchOutAt': null,
      'breaks': [
        {'startAt': '2026-10-12T13:00:00', 'endAt': null, 'minutes': 0},
      ],
    });

    expect(day.stamps.map((stamp) => stamp.kind), [DayStampKind.punchIn, DayStampKind.onBreak]);
    expect(day.stamps.last.until, isNull);
  });

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

  testWidgets('a worked day lists the punches and the break it held', (tester) async {
    await _pump(tester);

    await tester.tap(_day(_FakeRepository.punchedDay));
    await tester.pump();

    expect(find.text('Your activity'), findsOneWidget);
    expect(find.text('Punch In'), findsOneWidget);
    expect(find.text('9:02 AM'), findsOneWidget);
    expect(find.text('Break'), findsOneWidget);
    expect(find.text('1:00 PM – 1:30 PM'), findsOneWidget);
    expect(find.text('Punch Out'), findsOneWidget);
    expect(find.text('4:45 PM'), findsOneWidget);
  });

  testWidgets('a day never punched says so rather than hiding the card', (tester) async {
    await _pump(tester);

    // The 25th carries an event but no punch.
    await tester.tap(_day(25));
    await tester.pump();

    expect(find.text('Your activity'), findsOneWidget);
    expect(find.text('No punch recorded on this day.'), findsOneWidget);
    expect(find.text('Punch In'), findsNothing);
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
