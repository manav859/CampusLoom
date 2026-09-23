import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/widgets/app_chips.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/teacher_models.dart';
import 'package:smartshala_mobile/features/principal/teachers/teacher_attendance_screen.dart';

/// A GET /staff-attendance/day body, shaped as the backend returns it.
Map<String, dynamic> _dayJson({String? holiday}) => {
      'date': '2026-09-23',
      'isSunday': false,
      'holiday': holiday,
      'total': 4,
      'present': 2,
      'onLeave': 1,
      'notPunchedIn': 1,
      'staff': [
        {'id': 'e', 'fullName': 'Esha Verma', 'phone': '9876500005', 'status': 'NOT_PUNCHED_IN', 'leaveType': null, 'punchInAt': null, 'punchOutAt': null, 'workedMinutes': null},
        {'id': 'c', 'fullName': 'Chetan Rao', 'phone': '9876500003', 'status': 'ON_LEAVE', 'leaveType': 'SICK', 'punchInAt': null, 'punchOutAt': null, 'workedMinutes': null},
        {
          'id': 'a',
          'fullName': 'Anita Sharma',
          'phone': '9876500001',
          'status': 'PRESENT',
          'leaveType': null,
          'punchInAt': DateTime(2026, 9, 23, 8, 5).toUtc().toIso8601String(),
          'punchOutAt': DateTime(2026, 9, 23, 14, 30).toUtc().toIso8601String(),
          'workedMinutes': 385,
        },
        {
          'id': 'b',
          'fullName': 'Bhavna Joshi',
          'phone': '9876500002',
          'status': 'PRESENT',
          'leaveType': null,
          'punchInAt': DateTime(2026, 9, 23, 8, 15).toUtc().toIso8601String(),
          'punchOutAt': null,
          'workedMinutes': 165,
        },
      ],
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  final requested = <DateTime>[];
  String? holiday;

  @override
  Future<StaffDay> staffDay(DateTime date) async {
    requested.add(date);
    return StaffDay.fromJson(_dayJson(holiday: holiday));
  }
}

Future<_FakeRepository> _pump(WidgetTester tester, {double width = 390, double textScale = 1, String? holiday}) async {
  tester.view.physicalSize = Size(width * 2, 5000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repository = _FakeRepository()..holiday = holiday;
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repository,
      child: MaterialApp(
        builder: (context, child) => AppViewport(child: child),
        home: TeacherAttendanceScreen(today: DateTime(2026, 9, 23, 10, 30)),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return repository;
}

void main() {
  test('reads each status, the leave type and local punch times', () {
    final day = StaffDay.fromJson(_dayJson());
    expect(day.staff.map((row) => row.status), [
      StaffDayStatus.notPunchedIn,
      StaffDayStatus.onLeave,
      StaffDayStatus.present,
      StaffDayStatus.present,
    ]);
    expect(day.staff[1].leaveType, LeaveType.sick);
    expect(day.staff[2].punchInAt, DateTime(2026, 9, 23, 8, 5));
    expect(day.staff[0].leaveType, isNull);
  });

  test('each row says what the principal needs to know about it', () {
    final rows = StaffDay.fromJson(_dayJson()).staff;
    expect(staffDayDetail(rows[0]), '9876500005', reason: 'not in: the number to call');
    expect(staffDayDetail(rows[1]), 'Sick Leave');
    expect(staffDayDetail(rows[2]), 'In 8:05 AM · Out 2:30 PM · 6h 25m');
    expect(staffDayDetail(rows[3]), 'In 8:15 AM · not punched out · 2h 45m');
    final unclosed = StaffDayRow.fromJson({..._dayJson()['staff'][3] as Map<String, dynamic>, 'workedMinutes': null});
    expect(staffDayDetail(unclosed), 'In 8:15 AM · not punched out', reason: 'a past day left open has no hours');
  });

  testWidgets('opens on today with the tiles, and the tabs filter the list', (tester) async {
    final repository = await _pump(tester);

    expect(repository.requested, [DateTime(2026, 9, 23)]);
    expect(find.text('Today · Wed, 23 Sep 2026'), findsOneWidget);
    for (final name in ['Esha Verma', 'Chetan Rao', 'Anita Sharma', 'Bhavna Joshi']) {
      expect(find.text(name), findsOneWidget, reason: name);
    }
    expect(
      tester.getTopLeft(find.text('Esha Verma')).dy,
      lessThan(tester.getTopLeft(find.text('Anita Sharma')).dy),
      reason: 'teachers not in yet come first, in server order',
    );

    await tester.tap(find.descendant(of: find.byType(SegmentedTabs), matching: find.text('Not In')));
    await tester.pumpAndSettle();
    expect(find.text('Esha Verma'), findsOneWidget);
    expect(find.text('Anita Sharma'), findsNothing);

    // The tabs scroll sideways; Present starts past the edge of a phone.
    final presentTab = find.descendant(of: find.byType(SegmentedTabs), matching: find.text('Present'));
    await tester.drag(find.byType(SegmentedTabs), const Offset(-300, 0));
    await tester.pumpAndSettle();
    await tester.tap(presentTab);
    await tester.pumpAndSettle();
    expect(find.text('Anita Sharma'), findsOneWidget);
    expect(find.text('Esha Verma'), findsNothing);
  });

  testWidgets('steps back a day, and forward again no further than today', (tester) async {
    final repository = await _pump(tester);

    final next = find.widgetWithIcon(IconButton, Icons.chevron_right_rounded);
    expect(tester.widget<IconButton>(next).onPressed, isNull, reason: 'no future days');

    await tester.tap(find.widgetWithIcon(IconButton, Icons.chevron_left_rounded));
    await tester.pumpAndSettle();
    expect(repository.requested.last, DateTime(2026, 9, 22));
    expect(find.text('Tue, 22 Sep 2026'), findsOneWidget);

    await tester.tap(next);
    await tester.pumpAndSettle();
    expect(repository.requested.last, DateTime(2026, 9, 23));
    expect(tester.widget<IconButton>(next).onPressed, isNull);
  });

  testWidgets('says when the day is a school holiday', (tester) async {
    await _pump(tester, holiday: 'Founders Day');
    expect(find.text('School holiday: Founders Day'), findsOneWidget);
  });

  // A layout overflow fails a widget test, so reaching the end proves the screen fits.
  testWidgets('fits a small phone with large text, and a tablet', (tester) async {
    await _pump(tester, width: 320, textScale: 1.3);
    expect(find.text('Esha Verma'), findsOneWidget);
    await _pump(tester, width: 1200);
    expect(find.text('Esha Verma'), findsOneWidget);
  });
}
