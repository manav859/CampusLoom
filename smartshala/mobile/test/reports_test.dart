import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/exam_models.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/report_models.dart';
import 'package:smartshala_mobile/features/principal/data/teacher_models.dart';
import 'package:smartshala_mobile/features/principal/reports/attendance_report_screen.dart';
import 'package:smartshala_mobile/features/principal/reports/class_performance_report_screen.dart';
import 'package:smartshala_mobile/features/principal/reports/reports_screen.dart';
import 'package:smartshala_mobile/features/principal/reports/student_report_screen.dart';
import 'package:smartshala_mobile/features/principal/reports/subject_performance_report_screen.dart';
import 'package:smartshala_mobile/features/principal/reports/teacher_report_screen.dart';

ExamSummary _exam(String id, {String classId = 'c1', String className = '6-A', String subject = 'Maths', int average = 0, int entered = 0, int pending = 0}) =>
    ExamSummary.fromJson({
      'id': id,
      'classId': classId,
      'className': className,
      'subject': subject,
      'name': 'Exam $id',
      'term': 'UNIT_TEST',
      'maxMarks': 50,
      'date': '2026-09-01T00:00:00.000Z',
      'enteredCount': entered,
      'pendingCount': pending,
      'classAverage': average,
    });

/// The shape GET /analytics/risk-summary returns, fee fields included.
Map<String, dynamic> _riskSummary() => {
      'lowAttendanceCount': 2,
      'principalSummary': '1 students need priority follow-up for both low attendance and pending fees.',
      'studentRisks': [
        {
          'studentId': 's1',
          'studentName': 'Low And Owes',
          'className': '6-A',
          'attendancePercentage': 70,
          'absentThisMonth': 4,
          'pendingFees': 12000,
          'flags': ['LOW_ATTENDANCE', 'REPEAT_ABSENTEE', 'FEE_PENDING'],
          'severity': 'HIGH',
          'explainers': ['Pending fees Rs. 12000.00'],
        },
        {
          'studentId': 's2',
          'studentName': 'Only Owes',
          'className': '7-B',
          'attendancePercentage': 100,
          'absentThisMonth': 0,
          'pendingFees': 15000,
          'flags': ['FEE_PENDING'],
          'severity': 'MEDIUM',
        },
        {
          'studentId': 's3',
          'studentName': 'Watch And Owes',
          'className': '7-B',
          'attendancePercentage': 80,
          'absentThisMonth': 1,
          'pendingFees': 20000,
          'flags': ['ATTENDANCE_WATCH', 'ABSENCE_WATCH', 'FEE_PENDING'],
          'severity': 'MEDIUM',
        },
        {
          'studentId': 's4',
          'studentName': 'Very Low',
          'className': '8-C',
          'attendancePercentage': 55,
          'absentThisMonth': 2,
          'pendingFees': 0,
          'flags': ['LOW_ATTENDANCE', 'ABSENCE_WATCH'],
          'severity': 'HIGH',
        },
      ],
    };

TeacherRow _teacher(String name, {List<Map<String, dynamic>> periods = const [], List<Map<String, dynamic>> classTeacherFor = const []}) =>
    TeacherRow.fromJson({
      'id': 'id-$name',
      'fullName': name,
      'phone': '9000000000',
      'status': 'ACTIVE',
      'periodAssignments': periods,
      'classTeacherFor': classTeacherFor,
    });

ClassAttendanceRow _attendance(String classId, String className, {required bool marked, String? teacher}) => ClassAttendanceRow(
      classId: classId,
      className: className,
      marked: marked,
      total: marked ? 30 : 0,
      present: marked ? 25 : 0,
      late: marked ? 2 : 0,
      halfDay: 0,
      absent: marked ? 3 : 0,
      percentage: marked ? 90 : 0,
      classTeacherName: teacher,
    );

class _FakeRepository extends Fake implements PrincipalRepository {
  final nudged = <({String dateFrom, String dateTo})>[];
  final ranges = <({String dateFrom, String dateTo})>[];

  @override
  Future<AttendanceOverview> attendanceOverview(({String dateFrom, String dateTo}) range) async {
    ranges.add(range);
    return AttendanceOverview.fromJson({
      'totalClasses': 3,
      'markedClasses': 2,
      'pendingClasses': 1,
      'attendancePercentage': 90,
      'students': {'present': 54, 'absent': 6, 'halfDay': 0},
    });
  }

  @override
  Future<List<ClassAttendanceRow>> classAttendance(({String dateFrom, String dateTo}) range) async => [
        _attendance('c1', '6A', marked: true, teacher: 'Asha Rao'),
        _attendance('c2', '7B', marked: true, teacher: 'Vikram Shah'),
        _attendance('c3', '8C', marked: false, teacher: 'Neha Iyer'),
      ];

  @override
  Future<({int sent, int pending})> nudgePendingTeachers(({String dateFrom, String dateTo}) range) async {
    nudged.add(range);
    return (sent: 1, pending: 1);
  }

  @override
  Future<List<ClassPerformanceRow>> classPerformance() async => [
        ClassPerformanceRow.fromJson({'classId': 'c1', 'className': '6-A', 'studentCount': 30, 'markedDays': 10, 'attendancePercentage': 88, 'status': 'Healthy'}),
        ClassPerformanceRow.fromJson({'classId': 'c2', 'className': '7-B', 'studentCount': 28, 'markedDays': 9, 'attendancePercentage': 71, 'status': 'Needs attention'}),
      ];

  @override
  Future<List<ExamSummary>> exams({String? classId}) async => [
        _exam('e1', average: 80, entered: 30),
        _exam('e2', average: 50, entered: 10, pending: 20),
        _exam('e3', classId: 'c2', className: '7-B', subject: 'Science'),
      ];

  @override
  Future<List<StudentRisk>> studentRisks() async => academicRisks(_riskSummary());

  @override
  Future<List<TeacherRow>> teachers({bool inactive = false}) async => [
        _teacher('Asha Rao', classTeacherFor: [
          {'id': 'c1', 'name': '6', 'section': 'A'},
        ]),
      ];
}

Future<_FakeRepository> _pump(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1}) async {
  tester.view.physicalSize = Size(width * 2, 6000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repo = _FakeRepository();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repo,
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

/// Anything that would put money on a Reports screen.
final _financeText = find.byWidgetPredicate((widget) {
  if (widget is! Text) return false;
  final text = (widget.data ?? widget.textSpan?.toPlainText() ?? '').toLowerCase();
  return text.contains('fee') || text.contains('finance') || text.contains('₹') || text.contains('rs.');
});

void main() {
  group('Report rules', () {
    test('ranges match the web filter, with weeks starting on Sunday', () {
      final wednesday = DateTime(2026, 9, 16, 14);
      expect(ReportRange.today.datesAt(wednesday), (dateFrom: '2026-09-16', dateTo: '2026-09-16'));
      expect(ReportRange.yesterday.datesAt(wednesday), (dateFrom: '2026-09-15', dateTo: '2026-09-15'));
      expect(ReportRange.week.datesAt(wednesday), (dateFrom: '2026-09-13', dateTo: '2026-09-16'));
      expect(ReportRange.week.datesAt(DateTime(2026, 9, 13)), (dateFrom: '2026-09-13', dateTo: '2026-09-13'));
      expect(ReportRange.month.datesAt(wednesday), (dateFrom: '2026-09-01', dateTo: '2026-09-16'));
    });

    test('the attendance CSV has the web’s columns and marks pending classes', () {
      final csv = attendanceCsv(
        schoolName: 'Noble "Public" School',
        rangeLabel: '2026-09-16',
        rows: [
          _attendance('c1', '6A', marked: true, teacher: 'Asha Rao'),
          _attendance('c3', '8C', marked: false),
        ],
      ).split('\n');
      expect(csv[0], startsWith('"Noble ""Public"" School",'));
      expect(csv[2], '"Class","Teacher","Marked","Total","Present","Late","Half day","Absent","Rate"');
      expect(csv[3], '"6A","Asha Rao","Yes","30","25","2","0","3","90%"');
      expect(csv[4], '"8C","","No","0","0","0","0","0","Pending"');
    });

    test('exam averages weigh each exam by the marks entered', () {
      final exams = [_exam('a', average: 80, entered: 30), _exam('b', average: 50, entered: 10), _exam('c', average: 99)];
      expect(weightedExamAverage(exams), 73);
      expect(weightedExamAverage([_exam('d')]), isNull);

      final rows = subjectPerformance([
        ...exams,
        _exam('e', className: '5-A', subject: 'Science', average: 60, entered: 5, pending: 2),
      ]);
      expect(rows.map((row) => '${row.className} ${row.subject}'), ['5-A Science', '6-A Maths']);
      expect(rows[1].examCount, 3);
      expect(rows[1].average, 73);
      expect(rows[1].bestExamAverage, 80, reason: 'an exam with no marks is not the best');
      expect(rows[0].resultsPending, 2);
    });

    test('student risks drop every fee signal and re-rate without it', () {
      final risks = academicRisks(_riskSummary());
      // Most urgent first, then lowest attendance, as the server sorts.
      expect(risks.map((risk) => risk.studentName), ['Very Low', 'Low And Owes', 'Watch And Owes']);
      expect(risks.expand((risk) => risk.flags).where((flag) => flag.contains('FEE')), isEmpty);
      // Two attendance flags stay high; a pending fee no longer makes a watch-only student medium.
      expect(risks[1].level, RiskLevel.high);
      expect(risks[0].level, RiskLevel.high, reason: 'below 60% is high on its own');
      expect(risks[2].level, RiskLevel.low);
    });

    test('the teacher report counts today’s periods and their classes’ attendance', () {
      final monday = DateTime(2026, 9, 14);
      final rows = teacherReport(
        [
          _teacher('Asha Rao', periods: [
            {'dayOfWeek': 'MONDAY', 'periodNumber': 1, 'classId': 'c2', 'className': '7-B', 'subjectId': 'x', 'subjectName': 'Maths'},
            {'dayOfWeek': 'MONDAY', 'periodNumber': 2, 'classId': 'c2', 'className': '7-B', 'subjectId': 'x', 'subjectName': 'Maths'},
            {'dayOfWeek': 'MONDAY', 'periodNumber': 3, 'classId': null, 'className': '', 'subjectId': null, 'subjectName': 'Free period'},
            {'dayOfWeek': 'TUESDAY', 'periodNumber': 1, 'classId': 'c3', 'className': '8-C', 'subjectId': 'y', 'subjectName': 'Science'},
          ]),
        ],
        [
          _attendance('c1', '6A', marked: false, teacher: 'Asha Rao'),
          _attendance('c2', '7B', marked: true),
          _attendance('c3', '8C', marked: false),
        ],
        monday,
      );
      expect(rows.single.periodsToday, 2);
      expect(rows.single.subjectsToday, ['Maths']);
      expect(rows.single.markedClasses, ['7B']);
      expect(rows.single.pendingClasses, ['6A']);
    });
  });

  group('Reports screens', () {
    testWidgets('Reports has no fee or finance entry anywhere', (tester) async {
      await _pump(tester, const ReportsScreen());
      expect(find.text('Quick Access'), findsOneWidget);
      expect(find.text('Detailed Reports'), findsOneWidget);
      expect(_financeText, findsNothing);
      for (final report in [...ReportsScreen.quickAccess, ...ReportsScreen.detailed]) {
        expect(report.title.toLowerCase(), isNot(contains('fee')));
      }

      await tester.enterText(find.byType(TextField), 'subject');
      await tester.pumpAndSettle();
      expect(find.text('Subject Wise Performance'), findsOneWidget);
      expect(find.text('Student Report'), findsNothing);
    });

    testWidgets('the attendance report changes range and nudges pending teachers', (tester) async {
      // Wide enough that every range tab is on screen without scrolling.
      final repo = await _pump(tester, const AttendanceReportScreen(), width: 700);
      expect(find.text('2/3'), findsOneWidget);
      expect(find.text('Pending Classes (1)'), findsOneWidget);
      expect(find.text('8C · Neha Iyer'), findsOneWidget);

      await tester.tap(find.text('This month'));
      await tester.pumpAndSettle();
      expect(repo.ranges.last.dateFrom, endsWith('-01'));

      await tester.tap(find.text('Nudge Teachers'));
      await tester.pumpAndSettle();
      expect(repo.nudged, hasLength(1));
      expect(find.text('Nudged 1 of 1 pending class teachers.'), findsOneWidget);
    });

    testWidgets('the student report shows no fee data from the risk summary', (tester) async {
      await _pump(tester, const StudentReportScreen());
      expect(find.text('Low And Owes'), findsOneWidget);
      expect(find.text('Only Owes'), findsNothing);
      expect(_financeText, findsNothing);
    });

    testWidgets('class performance joins attendance to exam averages', (tester) async {
      await _pump(tester, const ClassPerformanceReportScreen());
      expect(find.text('73% avg'), findsOneWidget);
      expect(find.text('Needs attention'), findsOneWidget);
      expect(_financeText, findsNothing);
    });

    for (final (name, screen) in [
      ('Reports', const ReportsScreen()),
      ('Attendance', const AttendanceReportScreen()),
      ('Class performance', const ClassPerformanceReportScreen()),
      ('Subject performance', const SubjectPerformanceReportScreen()),
      ('Students', const StudentReportScreen()),
      ('Teachers', const TeacherReportScreen()),
    ]) {
      testWidgets('$name report lays out at 320dp with 1.3x text', (tester) async {
        await _pump(tester, screen, width: 320, textScale: 1.3);
        expect(tester.takeException(), isNull);
        expect(_financeText, findsNothing);
      });
    }
  });
}
