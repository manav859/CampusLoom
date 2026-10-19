import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/auth/app_user.dart';
import 'package:smartshala_mobile/core/auth/auth_controller.dart';
import 'package:smartshala_mobile/core/data/timetable_models.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/timetable/todays_classes_screen.dart';

/// GET /users/me/schedule/week as the backend returns it for a teacher. Every
/// weekday carries the same three periods, so the screen shows the same day
/// whichever day the test runs on.
Map<String, dynamic> _weekJson() => {
      'days': [
        for (final day in const [
          ('MONDAY', 'Monday'),
          ('TUESDAY', 'Tuesday'),
          ('WEDNESDAY', 'Wednesday'),
          ('THURSDAY', 'Thursday'),
          ('FRIDAY', 'Friday'),
          ('SATURDAY', 'Saturday'),
        ])
          {
            'dayOfWeek': day.$1,
            'label': day.$2,
            'periods': [
              {
                'periodNumber': 1,
                'className': '7-A',
                'classId': 'class-a',
                'subjectName': 'English',
                'startTime': '09:00',
                'endTime': '10:00',
              },
              {
                'periodNumber': 2,
                'className': '7-B',
                'classId': 'class-b',
                'subjectName': 'Mathematics',
                'startTime': '10:00',
                'endTime': '11:00',
              },
              {
                'periodNumber': 4,
                'className': '7-A',
                'classId': 'class-a',
                'subjectName': 'Science',
                'startTime': '11:30',
                'endTime': '12:30',
              },
            ],
          },
      ],
    };

/// 7-A is this teacher's own class; 7-B is one they only take periods in.
const _me = AppUser(id: 'teacher-1', fullName: 'Anita Sharma', role: 'TEACHER', schoolName: 'Noble Public School');

class _FakeRepository extends Fake implements TeacherRepository {
  @override
  Future<WeekTimetable> weekTimetable() async => WeekTimetable.forTeacher(_weekJson());

  @override
  Future<List<ClassOption>> myClasses({bool classTeacherOnly = false}) async => const [
        ClassOption(id: 'class-a', name: '7', section: 'A', studentCount: 32, classTeacherId: 'teacher-1'),
        ClassOption(id: 'class-b', name: '7', section: 'B', studentCount: 28, classTeacherId: 'teacher-9'),
      ];
}

class _FakeAuth extends ChangeNotifier implements AuthController {
  @override
  AppUser? user = _me;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _pump(WidgetTester tester, {double width = 390, double textScale = 1.0}) async {
  tester.view.physicalSize = Size(width * 2, 9000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthController>.value(value: _FakeAuth()),
        Provider<TeacherRepository>.value(value: _FakeRepository()),
      ],
      child: MaterialApp(
        builder: (context, child) => AppViewport(child: child),
        home: const TodaysClassesScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

TimetableSlot _slot({String? start, String? end}) =>
    TimetableSlot(periodNumber: 1, startTime: start, endTime: end, subjectName: 'English', holderName: '7-A');

void main() {
  group('periodStanding', () {
    final today = DateTime(2026, 10, 12, 10, 30);
    final slot = _slot(start: '09:00', end: '10:00');

    test('reads today off the clock', () {
      expect(periodStanding(slot, today, today), PeriodStanding.completed);
      expect(periodStanding(_slot(start: '10:00', end: '11:00'), today, today), PeriodStanding.inClass);
      expect(periodStanding(_slot(start: '11:30', end: '12:30'), today, today), PeriodStanding.upcoming);
    });

    test('ends a period on its last minute, and starts one on its first', () {
      final atTen = DateTime(2026, 10, 12, 10, 00);
      expect(periodStanding(_slot(start: '09:00', end: '10:00'), atTen, atTen), PeriodStanding.completed);
      expect(periodStanding(_slot(start: '10:00', end: '11:00'), atTen, atTen), PeriodStanding.inClass);
    });

    test('has nothing to say about a period with no bell time', () {
      expect(periodStanding(_slot(), today, today), isNull);
      expect(periodStanding(_slot(start: '09:00'), today, today), isNull);
    });

    test('takes another day whole: past is done, ahead is to come', () {
      expect(periodStanding(slot, DateTime(2026, 10, 9), today), PeriodStanding.completed);
      expect(periodStanding(_slot(start: '11:30', end: '12:30'), DateTime(2026, 10, 15), today), PeriodStanding.upcoming);
    });
  });

  group('timetableDateOf', () {
    test('counts Monday first from the week the day falls in', () {
      // Wednesday 14 October 2026.
      final wednesday = DateTime(2026, 10, 14, 9);
      expect(timetableDateOf(0, wednesday), DateTime(2026, 10, 12));
      expect(timetableDateOf(2, wednesday), DateTime(2026, 10, 14));
      expect(timetableDateOf(5, wednesday), DateTime(2026, 10, 17), reason: 'Saturday closes the week');
    });

    test('rolls to the week ahead on a Sunday, when nothing is taught', () {
      final sunday = DateTime(2026, 10, 18, 9);
      expect(timetableDateOf(0, sunday), DateTime(2026, 10, 19));
    });
  });

  testWidgets('lists the day period by period, with the class and its strength', (tester) async {
    await _pump(tester);

    expect(find.text('English'), findsOneWidget);
    expect(find.text('Mathematics'), findsOneWidget);
    expect(find.text('Science'), findsOneWidget);
    expect(find.text('Class 7-A  •  32 Students'), findsNWidgets(2));
    expect(find.text('Class 7-B  •  28 Students'), findsOneWidget);
    expect(find.text('09:00 AM – 10:00 AM'), findsOneWidget, reason: 'the bell is read as a teacher reads it');

    // The screen opens on today, and names its date.
    final now = DateTime.now();
    final today = WeekTimetable.forTeacher(_weekJson()).indexOfToday(now);
    expect(find.text(timetableDateLabel(timetableDateOf(today, now))), findsOneWidget);

    // The three standings also label the rows' badges, so only the day's own
    // count is unique on screen.
    expect(find.text('Classes Today'), findsOneWidget);
    for (final label in ['Completed', 'Upcoming', 'In Class']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
    final total = find.ancestor(of: find.text('Classes Today'), matching: find.byType(Column)).first;
    expect(find.descendant(of: total, matching: find.text('3')), findsOneWidget, reason: 'three periods on the day');
  });

  testWidgets('only the classes the teacher is class teacher of open attendance', (tester) async {
    await _pump(tester);

    final rows = tester.widgetList<InkWell>(find.byType(InkWell)).where((row) => row.onTap != null).length;
    // The date picker always taps; 7-A's two periods do only on the day itself.
    expect(rows, DateTime.now().weekday == DateTime.sunday ? 1 : 3);
  });

  testWidgets('the date row offers every weekday of the week', (tester) async {
    await _pump(tester);

    await tester.tap(find.byIcon(Icons.expand_more_rounded));
    await tester.pumpAndSettle();

    for (final index in [0, 5]) {
      expect(find.text(timetableDateLabel(timetableDateOf(index, DateTime.now()))), findsWidgets);
    }
    expect(find.text('3 classes'), findsNWidgets(6), reason: 'six weekdays, three periods each');
  });

  testWidgets('lays out without overflow on a small phone with large text', (tester) async {
    await _pump(tester, width: 320, textScale: 1.3);
    expect(find.text('Classes Today'), findsOneWidget);
  });
}
