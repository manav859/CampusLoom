import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/auth/app_user.dart';
import 'package:smartshala_mobile/core/auth/auth_controller.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/data/messages_repository.dart';
import 'package:smartshala_mobile/core/data/timetable_models.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/teacher/data/punch_controller.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/teacher_home_screen.dart';
import 'package:smartshala_mobile/features/teacher/teacher_more_sheet.dart';

/// A GET /dashboard body for a teacher, shaped exactly as the backend returns it.
const _dashboardJson = {
  'role': 'TEACHER',
  'kpis': {
    'assignedClasses': 3,
    'assignedStudents': 96,
    'absentToday': 2,
    'pendingAttendance': 1,
    'pendingHomeworkSubmissions': 7,
  },
  'attendance': [
    {'classId': 'a', 'className': '6-A', 'totalStudents': 32, 'marked': true, 'present': 30, 'absent': 2, 'attendancePercentage': 94},
    {'classId': 'b', 'className': '7-B', 'totalStudents': 34, 'marked': true, 'present': 20, 'absent': 14, 'attendancePercentage': 59},
    {'classId': 'c', 'className': '8-C', 'totalStudents': 30, 'marked': false, 'present': 0, 'absent': 0, 'attendancePercentage': 0},
  ],
  'alerts': [
    {'type': 'ATTENDANCE_PENDING', 'message': '8-C attendance is not submitted yet.', 'severity': 'MEDIUM'},
    {'type': 'HOMEWORK_PENDING', 'message': '7 homework submissions need follow-up.', 'severity': 'MEDIUM'},
  ],
};

class _FakeRepository extends Fake implements TeacherRepository {
  @override
  Future<TeacherDashboard> dashboard() async => TeacherDashboard.fromJson(_dashboardJson);

  @override
  Future<List<SchedulePeriod>> todaySchedule() async => const [
        SchedulePeriod(periodNumber: 1, className: '6-A', subjectName: 'Mathematics', startTime: '08:00', endTime: '08:45'),
        SchedulePeriod(periodNumber: 2, className: '7-B', subjectName: 'Science'),
      ];

  // The More sheet's My Timetable screen asks for this; failing is enough to prove it opened.
  @override
  Future<WeekTimetable> weekTimetable() => Future.error(ApiException(message: 'offline', code: 'NETWORK'));

  @override
  Future<PunchStatus> punchStatus() async => PunchStatus(
        state: PunchState.punchedIn,
        punchInAt: DateTime(2026, 9, 13, 8, 5),
        workedMinutes: 125,
      );
}

class _FakeMessages extends Fake implements MessagesRepository {
  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async =>
      const AnnouncementPage(items: [], total: 2, unreadCount: 2, hasMore: false);
}

class _FakeAuth extends ChangeNotifier implements AuthController {
  @override
  AppUser? user = const AppUser(id: 'u1', fullName: 'Anita Sharma Deshpande', role: 'TEACHER', schoolName: 'Noble Public School');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _pumpHome(WidgetTester tester, {required double width, double textScale = 1.0}) async {
  tester.view.physicalSize = Size(width * 2, 9000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repository = _FakeRepository();
  final punch = PunchController(repository);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthController>.value(value: _FakeAuth()),
        Provider<TeacherRepository>.value(value: repository),
        Provider<MessagesRepository>.value(value: _FakeMessages()),
        ChangeNotifierProvider<PunchController>.value(value: punch),
      ],
      child: MaterialApp(
        builder: (context, child) => AppViewport(child: child),
        home: const TeacherHomeScreen(),
      ),
    ),
  );
  await punch.load();
  await tester.pumpAndSettle();
}

void main() {
  group('TeacherDashboard.fromJson', () {
    final dashboard = TeacherDashboard.fromJson(_dashboardJson);

    test('reads the KPIs the web teacher dashboard shows', () {
      expect(dashboard.overview.assignedStudents, 96);
      expect(dashboard.overview.pendingAttendance, 1);
      expect(dashboard.overview.pendingHomeworkSubmissions, 7);
      expect(dashboard.overview.assignedClasses, 3);
    });

    test('derives the same pulse line and marked count as the web', () {
      // DashboardHome.tsx: `${pendingClasses} attendance actions and ${teacherPendingHomework} homework submissions pending for your students.`
      expect(dashboard.pulse, '1 attendance actions and 7 homework submissions pending for your students.');
      expect(dashboard.markedClasses, 2);
    });

    test('keeps per-class attendance and alerts in server order', () {
      expect(dashboard.attendance.map((item) => item.className), ['6-A', '7-B', '8-C']);
      expect(dashboard.attendance.last.marked, isFalse);
      expect(dashboard.alerts.first.type, 'ATTENDANCE_PENDING');
      expect(dashboard.alerts.first.severity, AlertSeverity.medium);
    });

    test('builds the same alert list as the web teacher dashboard', () {
      final alerts = dashboard.actionAlerts;
      expect(alerts.map((alert) => alert.label), [
        '8-C attendance is not submitted yet.',
        '7 homework submissions need follow-up.',
        '7-B low attendance',
      ]);
      expect(alerts.first.level, ActionLevel.high, reason: 'MEDIUM maps to the High badge');
      expect(alerts.last.detail, '59% attendance today');
      expect(alerts.last.level, ActionLevel.critical, reason: 'under 60% is critical');
    });
  });

  testWidgets('home shows the web dashboard sections with the same labels', (tester) async {
    await _pumpHome(tester, width: 390);

    expect(find.text('1 attendance actions and 7 homework submissions pending for your students.'), findsOneWidget);
    for (final label in ['Assigned Students', 'Pending Attendance', 'Pending Homework', 'Assigned Classes']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('96'), findsOneWidget);
    expect(find.text("Today's Punch"), findsOneWidget);
    expect(find.text('Punched in'), findsOneWidget);
    expect(find.text('2h 5m'), findsOneWidget);
    expect(find.text('Class 6-A'), findsNWidgets(2), reason: 'in the schedule and in class attendance');
    expect(find.text('94%'), findsOneWidget);
    expect(find.text('Not marked'), findsOneWidget);
    expect(find.text("Today's Actions"), findsOneWidget);
    expect(find.text('8-C attendance is not submitted yet.'), findsOneWidget);
    expect(find.text('7-B low attendance'), findsOneWidget, reason: 'the web adds marked classes under 75%');
    expect(find.text('2'), findsWidgets, reason: 'the bell shows the real unread count');
  });

  // A layout overflow fails a widget test, so reaching the end of
  // each pump proves the screen fits.
  testWidgets('home lays out without overflow on a small phone with large text', (tester) async {
    await _pumpHome(tester, width: 320, textScale: 1.3);
    expect(find.text('Assigned Students'), findsOneWidget);
  });

  testWidgets('home caps its width on a tablet and uses four KPI columns', (tester) async {
    await _pumpHome(tester, width: 1200);

    final students = tester.getRect(find.text('Assigned Students'));
    final classes = tester.getRect(find.text('Assigned Classes'));
    expect(students.top, closeTo(classes.top, 1), reason: 'all four KPI cards sit on one row');

    final scaffold = tester.getRect(find.byType(Scaffold).first);
    expect(scaffold.width, Breakpoints.maxContentWidth);
    expect(scaffold.center.dx, closeTo(600, 1), reason: 'content is centred');
  });

  testWidgets('More opens the teacher screens the grid has no tile for', (tester) async {
    await _pumpHome(tester, width: 390);

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    for (final title in ['My Timetable', 'Salary Details', 'Messages', 'Change Password']) {
      expect(find.text(title), findsOneWidget, reason: title);
    }
    expect(find.textContaining('later phase'), findsNothing);

    await tester.tap(find.text('My Timetable'));
    await tester.pumpAndSettle();
    expect(find.byType(TeacherMoreSheet), findsNothing, reason: 'the sheet closes before the screen opens');
    expect(find.widgetWithText(AppBar, 'My Timetable'), findsOneWidget);
  });

  test('adaptiveColumns drops a column on a small phone and widens on a tablet', () {
    expect(adaptiveColumns(320, phone: 4, wide: 8), 3);
    expect(adaptiveColumns(390, phone: 4, wide: 8), 4);
    expect(adaptiveColumns(700, phone: 4, wide: 8), 8);
  });
}
