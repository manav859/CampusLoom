import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/data/timetable_models.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/student_models.dart' show ClassChoice;
import 'package:smartshala_mobile/features/principal/timetable/timetable_screen.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/timetable/my_timetable_screen.dart';

const _weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const _labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

Map<String, Object?> _freeSlot(int periodNumber) => {
      'periodNumber': periodNumber,
      'startTime': null,
      'endTime': null,
      'subjectId': null,
      'subjectName': null,
      'teacherId': null,
      'teacherName': null,
      'contestedBy': 0,
    };

/// The shape GET /classes/:id/timetable returns: every period on every weekday,
/// free ones all null.
final _classWeekJson = <String, Object?>{
  'class': {'id': 'c1', 'name': '6', 'section': 'A', 'academicYear': '2026-2027'},
  'periodCount': 3,
  'days': [
    for (var index = 0; index < _weekdays.length; index++)
      {
        'dayOfWeek': _weekdays[index],
        'label': _labels[index],
        'periods': index == 0
            ? [
                {
                  'periodNumber': 1,
                  'startTime': '08:00',
                  'endTime': '08:40',
                  'subjectId': 'sub1',
                  'subjectName': 'Mathematics',
                  'teacherId': 't1',
                  'teacherName': 'Anita Rao',
                  'contestedBy': 0,
                },
                {
                  'periodNumber': 2,
                  'startTime': '08:45',
                  'endTime': '09:25',
                  'subjectId': 'sub2',
                  'subjectName': 'Science',
                  'teacherId': 't2',
                  'teacherName': 'Bhaskar Nair',
                  'contestedBy': 1,
                },
                _freeSlot(3),
              ]
            : [_freeSlot(1), _freeSlot(2), _freeSlot(3)],
      },
  ],
};

/// The shape GET /users/me/schedule/week returns: only the periods taught.
final _teacherWeekJson = <String, Object?>{
  'days': [
    for (var index = 0; index < _weekdays.length; index++)
      {
        'dayOfWeek': _weekdays[index],
        'label': _labels[index],
        'periods': index == 0
            ? [
                {
                  'periodNumber': 1,
                  'className': '6-A',
                  'subjectName': 'Mathematics',
                  'startTime': '08:00',
                  'endTime': '08:40',
                },
              ]
            : const <Object>[],
      },
  ],
};

class _FakePrincipal extends Fake implements PrincipalRepository {
  _FakePrincipal({this.classList, this.failWith});

  final List<ClassChoice>? classList;
  final String? failWith;
  final requested = <String>[];

  @override
  Future<List<ClassChoice>> classes() async =>
      classList ??
      const [
        ClassChoice(id: 'c1', name: '6', section: 'A'),
        ClassChoice(id: 'c2', name: '7', section: 'B'),
      ];

  @override
  Future<WeekTimetable> classTimetable(String id) async {
    requested.add(id);
    if (failWith != null) throw ApiException(message: failWith!, code: 'APP_ERROR');
    return WeekTimetable.forClass(_classWeekJson);
  }
}

class _FakeTeacher extends Fake implements TeacherRepository {
  _FakeTeacher({this.json, this.failWith});

  final Map<String, Object?>? json;
  final String? failWith;

  @override
  Future<WeekTimetable> weekTimetable() async {
    if (failWith != null) throw ApiException(message: failWith!, code: 'APP_ERROR');
    return WeekTimetable.forTeacher(json ?? _teacherWeekJson);
  }
}

Future<void> _pump(
  WidgetTester tester,
  Widget screen, {
  PrincipalRepository? principal,
  TeacherRepository? teacher,
  double width = 390,
  double textScale = 1,
}) async {
  tester.view.physicalSize = Size(width * 2, 6000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        if (principal != null) Provider<PrincipalRepository>.value(value: principal),
        if (teacher != null) Provider<TeacherRepository>.value(value: teacher),
      ],
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

/// Today's weekday name, or null at the weekend — the badge rule only runs
/// Monday to Friday.
String? _todayName() {
  final weekday = DateTime.now().weekday;
  return weekday > DateTime.friday ? null : _weekdays[weekday - 1];
}

void main() {
  group('Timetable models', () {
    test('a class week parses every period, free ones included', () {
      final week = WeekTimetable.forClass(_classWeekJson);

      expect(week.title, '6-A');
      expect(week.days.map((day) => day.dayOfWeek), _weekdays);
      expect(week.days.every((day) => day.periods.length == 3), isTrue);
      expect(week.taughtPeriods, 2);

      final monday = week.days.first;
      expect(monday.shortLabel, 'Mon');
      expect(monday.taughtPeriods, 2);
      expect(monday.periods[0].subjectName, 'Mathematics');
      expect(monday.periods[0].holderName, 'Anita Rao');
      expect(monday.periods[0].timeLabel, '08:00 – 08:40');
      expect(monday.periods[0].isFree, isFalse);
      expect(monday.periods[1].contestedBy, 1);
      expect(monday.periods[2].isFree, isTrue);
      expect(monday.periods[2].timeLabel, isNull);
    });

    test('a teacher week carries the class opposite the subject', () {
      final week = WeekTimetable.forTeacher(_teacherWeekJson);

      expect(week.title, isNull);
      expect(week.days.first.periods.single.holderName, '6-A');
      expect(week.days.first.periods.single.subjectName, 'Mathematics');
      expect(week.days.first.periods.single.contestedBy, 0);
      expect(week.days.skip(1).every((day) => day.periods.isEmpty), isTrue);
    });

    test('the week opens on today, and on Monday at the weekend', () {
      final week = WeekTimetable.forClass(_classWeekJson);

      expect(week.indexOfToday(DateTime(2026, 9, 14)), 0, reason: 'Monday');
      expect(week.indexOfToday(DateTime(2026, 9, 17)), 3, reason: 'Thursday');
      expect(week.indexOfToday(DateTime(2026, 9, 19)), 0, reason: 'Saturday falls back');
      expect(week.indexOfToday(DateTime(2026, 9, 20)), 0, reason: 'Sunday falls back');
    });

    test('an untimed period gets no badge and an unset bell reads as null', () {
      expect(timeToMinutes('08:05'), 485);
      expect(timeToMinutes(null), isNull);
      expect(timeToMinutes('8:5:0'), isNull);
      expect(
        periodBadges([(start: null, end: null)], DateTime(2026, 9, 14, 8, 10)),
        [null],
      );
    });
  });

  group('Principal Timetable', () {
    testWidgets('shows the first class week with its subjects and teachers', (tester) async {
      final repo = _FakePrincipal();
      await _pump(tester, const TimetableScreen(), principal: repo);

      expect(repo.requested, ['c1']);
      expect(find.text('6-A'), findsOneWidget, reason: 'the class filter chip');
      expect(find.text('Mon'), findsOneWidget);

      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('Anita Rao'), findsOneWidget);
      expect(find.text('08:00 – 08:40'), findsOneWidget);
      expect(find.text('Free period'), findsOneWidget, reason: 'Monday period 3');
    });

    testWidgets('names a class booked by two teachers', (tester) async {
      await _pump(tester, const TimetableScreen(), principal: _FakePrincipal());
      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      expect(find.text('Bhaskar Nair'), findsOneWidget);
      expect(find.text('Double-booked'), findsOneWidget);
    });

    testWidgets('a day nobody teaches says so', (tester) async {
      await _pump(tester, const TimetableScreen(), principal: _FakePrincipal());
      await tester.tap(find.text('Wed'));
      await tester.pumpAndSettle();

      expect(find.text('Nothing on Wednesday'), findsOneWidget);
      expect(find.text('No teacher has a period with this class that day.'), findsOneWidget);
    });

    testWidgets('switching class reloads that week', (tester) async {
      final repo = _FakePrincipal();
      await _pump(tester, const TimetableScreen(), principal: repo);

      await tester.tap(find.text('6-A'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7-B').last);
      await tester.pumpAndSettle();

      expect(repo.requested, ['c1', 'c2']);
    });

    testWidgets('says where periods are actually assigned', (tester) async {
      await _pump(tester, const TimetableScreen(), principal: _FakePrincipal());

      expect(
        find.textContaining('Periods are assigned on the web dashboard'),
        findsOneWidget,
      );
    });

    testWidgets('a school with no classes is not an error', (tester) async {
      await _pump(tester, const TimetableScreen(), principal: _FakePrincipal(classList: const []));

      expect(find.text('No classes yet'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('a failed load offers a retry', (tester) async {
      await _pump(
        tester,
        const TimetableScreen(),
        principal: _FakePrincipal(failWith: 'Server unavailable'),
      );

      expect(find.text('Server unavailable'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('fits a 320dp phone at 1.3x text', (tester) async {
      await _pump(
        tester,
        const TimetableScreen(),
        principal: _FakePrincipal(),
        width: 320,
        textScale: 1.3,
      );
      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Mathematics'), findsOneWidget);
    });
  });

  group('Teacher My Timetable', () {
    testWidgets('shows the week with the class under each subject', (tester) async {
      await _pump(tester, const MyTimetableScreen(), teacher: _FakeTeacher());
      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('6-A'), findsOneWidget);
      expect(find.text('08:00 – 08:40'), findsOneWidget);
    });

    testWidgets('an empty weekday says the teacher is free', (tester) async {
      await _pump(tester, const MyTimetableScreen(), teacher: _FakeTeacher());
      await tester.tap(find.text('Thu'));
      await tester.pumpAndSettle();

      expect(find.text('Nothing on Thursday'), findsOneWidget);
      expect(find.text('You have no periods that day.'), findsOneWidget);
    });

    testWidgets('a failed load offers a retry', (tester) async {
      await _pump(
        tester,
        const MyTimetableScreen(),
        teacher: _FakeTeacher(failWith: 'Unable to reach the server'),
      );

      expect(find.text('Unable to reach the server'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('Now marks the running period, and only on today', (tester) async {
      final now = DateTime.now();
      final today = _todayName();
      // A period that is running right now, placed on every weekday so the
      // test does not depend on which day it runs.
      final start = now.subtract(const Duration(minutes: 5));
      final end = now.add(const Duration(minutes: 5));
      String clock(DateTime at) =>
          '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

      final json = <String, Object?>{
        'days': [
          for (var index = 0; index < _weekdays.length; index++)
            {
              'dayOfWeek': _weekdays[index],
              'label': _labels[index],
              'periods': [
                {
                  'periodNumber': 1,
                  'className': '6-A',
                  'subjectName': 'Mathematics',
                  'startTime': clock(start),
                  'endTime': clock(end),
                },
              ],
            },
        ],
      };

      await _pump(tester, const MyTimetableScreen(), teacher: _FakeTeacher(json: json));

      if (today == null || start.day != end.day) {
        // At the weekend nothing is "now"; a period straddling midnight is not
        // a case the bell can produce, so skip rather than assert nonsense.
        expect(find.text('Now'), findsNothing);
        return;
      }

      expect(find.text('Now'), findsOneWidget, reason: 'today is $today');

      // The same period on another weekday must not claim to be running.
      final otherDay = _weekdays.indexOf(today) == 0 ? 'Fri' : 'Mon';
      await tester.tap(find.text(otherDay));
      await tester.pumpAndSettle();
      expect(find.text('Now'), findsNothing);
    });

    testWidgets('fits a 320dp phone at 1.3x text', (tester) async {
      await _pump(
        tester,
        const MyTimetableScreen(),
        teacher: _FakeTeacher(),
        width: 320,
        textScale: 1.3,
      );
      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Mathematics'), findsOneWidget);
    });
  });
}
