import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/data/timetable_models.dart';
import 'package:smartshala_mobile/core/theme/app_colors.dart';
import 'package:smartshala_mobile/core/widgets/home_blocks.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_exam_schedule_screen.dart';
import 'package:smartshala_mobile/features/parent/parent_home_screen.dart';
import 'package:smartshala_mobile/features/parent/parent_timetable_screen.dart';

/// The shape GET /parent/children/:id/timetable returns — the staff class
/// payload minus the staff-only fields, so WeekTimetable.forClass reads it.
const _timetableJson = {
  'class': {'name': '5', 'section': 'A'},
  'periodCount': 2,
  'days': [
    {
      'dayOfWeek': 'MONDAY',
      'label': 'Monday',
      'periods': [
        {
          'periodNumber': 1,
          'startTime': '08:00',
          'endTime': '08:40',
          'subjectName': 'Mathematics',
          'teacherName': 'Anita Kumari',
        },
        {'periodNumber': 2, 'startTime': '08:45', 'endTime': '09:25'},
      ],
    },
    {
      'dayOfWeek': 'TUESDAY',
      'label': 'Tuesday',
      'periods': [
        {'periodNumber': 1, 'startTime': '08:00', 'endTime': '08:40', 'subjectName': 'Hindi'},
      ],
    },
  ],
};

class _FakeParentRepository extends Fake implements ParentRepository {
  @override
  Future<WeekTimetable> timetable(String childId) async => WeekTimetable.forClass(_timetableJson);

  @override
  Future<ExamSchedule> examSchedule() async => (
        upcoming: [
          CalendarEvent(
            id: 'x1',
            type: CalendarEventType.exam,
            title: 'Half-Yearly Exam',
            description: 'Datesheet on the notice board.',
            startDate: DateTime(2026, 12, 10),
            endDate: DateTime(2026, 12, 18),
            startTime: '09:30',
            endTime: '12:30',
          ),
        ],
        past: [
          CalendarEvent(
            id: 'x2',
            type: CalendarEventType.exam,
            title: 'Unit Test 1',
            startDate: DateTime(2026, 8, 4),
            endDate: DateTime(2026, 8, 4),
          ),
        ],
      );

  @override
  Future<ChildHome> home(String childId) async => const ChildHome(
        parentName: 'Sunita Sharma',
        child: ParentChild(id: 'a', fullName: 'Aarav Sharma', className: '5 - A'),
        attendance: AttendanceSummary(
          month: '2026-11',
          percentage: 92,
          present: 18,
          absent: 1,
          leave: 0,
          totalDays: 19,
        ),
        todayStatus: AttendanceStatus.present,
      );

  @override
  Future<ChildFees> fees(String childId) async => const ChildFees(
        total: 0,
        paid: 0,
        balance: 0,
        status: 'PAID',
        assignments: [],
        payments: [],
      );

  @override
  Future<List<CalendarEvent>> calendar(DateTime month) async => const [];

  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async => AnnouncementPage.empty;
}

Widget _wrap(Widget child) => Provider<ParentRepository>.value(
      value: _FakeParentRepository(),
      child: MaterialApp(home: child),
    );

Future<void> _pump(
  WidgetTester tester,
  Widget screen, {
  double width = 600,
  double textScale = 1,
}) async {
  tester.view.physicalSize = Size(width * 2, 3000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(_wrap(screen));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('timetable opens on a weekday and lists its periods', (tester) async {
    await _pump(tester, const ParentTimetableScreen(childId: 'a', childName: 'Aarav Sharma'));

    // The class is named beside the child, and the selected day's periods show
    // with the teacher taking each one. A slot with no subject reads as free.
    expect(find.text('Aarav Sharma · 5-A'), findsOneWidget);
    expect(find.text('Mathematics'), findsOneWidget);
    expect(find.text('Anita Kumari'), findsOneWidget);
    expect(find.text('08:00 – 08:40'), findsOneWidget);
    expect(find.text('Free period'), findsOneWidget);
  });

  testWidgets('exam schedule shows upcoming exams and switches to completed', (tester) async {
    await _pump(tester, const ParentExamScheduleScreen(childName: 'Aarav Sharma'));

    expect(find.text('Half-Yearly Exam'), findsOneWidget);
    expect(find.text('10 Dec – 18 Dec 2026'), findsOneWidget);
    expect(find.text('9:30 AM – 12:30 PM'), findsOneWidget);
    expect(find.text('Unit Test 1'), findsNothing);

    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();

    expect(find.text('Unit Test 1'), findsOneWidget);
    expect(find.text('Tuesday, 4 Aug 2026'), findsOneWidget);
    expect(find.text('Half-Yearly Exam'), findsNothing);
  });

  testWidgets('Home quick links reach the four detail screens', (tester) async {
    await _pump(
      tester,
      Scaffold(
        body: ParentHomeScreen(
          child: const ParentChild(id: 'a', fullName: 'Aarav Sharma', className: '5 - A'),
          onSelectTab: (_) {},
        ),
      ),
    );

    for (final label in ['Academics', 'Homework', 'Timetable', 'Exams']) {
      expect(find.text(label), findsOneWidget);
    }

    await tester.tap(find.text('Timetable'));
    await tester.pumpAndSettle();
    expect(find.text('Class Timetable'), findsOneWidget);
  });

  // A layout overflow fails a widget test, so reaching the end proves the
  // screen fits the smallest phone at the largest text a parent is likely to
  // have set. Home is checked separately because it overflows there already,
  // before this row was added.
  testWidgets('the quick-link row fits 320dp at 1.3x text', (tester) async {
    await _pump(
      tester,
      Scaffold(
        body: ResponsiveGrid(
          phoneColumns: 4,
          wideColumns: 8,
          children: [
            for (final label in ['Academics', 'Homework', 'Timetable', 'Exams'])
              HomeQuickAction(
                icon: Icons.school_rounded,
                title: label,
                chip: AppColors.primarySoft,
                accent: AppColors.primary,
              ),
          ],
        ),
      ),
      width: 320,
      textScale: 1.3,
    );
    expect(find.text('Timetable'), findsOneWidget);
  });

  testWidgets('the timetable fits 320dp at 1.3x text', (tester) async {
    await _pump(tester, const ParentTimetableScreen(childId: 'a', childName: 'Aarav Sharma'),
        width: 320, textScale: 1.3);
    expect(find.text('Mathematics'), findsOneWidget);
  });

  testWidgets('the exam schedule fits 320dp at 1.3x text', (tester) async {
    await _pump(tester, const ParentExamScheduleScreen(childName: 'Aarav Sharma'),
        width: 320, textScale: 1.3);
    expect(find.text('Half-Yearly Exam'), findsOneWidget);
  });
}
