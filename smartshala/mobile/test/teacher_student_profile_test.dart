import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/student_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/students/student_profile_screen.dart';

/// A teacher's GET /students/:id: the rich profile the web teacher sees —
/// academic, attendance and a fees *summary*, but no fee assignments and no
/// documents tab.
class _FakeRepository extends Fake implements TeacherRepository {
  @override
  Future<StudentDetail> student(String id) async => StudentDetail.fromJson({
        'id': 's1',
        'fullName': 'Aditya Parikh',
        'admissionNumber': 'ADM-1',
        'rollNumber': 3,
        'isActive': true,
        'parentName': 'Rahul Parikh',
        'parentPhone': '9876500001',
        'class': {'name': '1', 'section': 'A', 'academicYear': '2025-26'},
        'access': {
          'role': 'TEACHER',
          'allowedTabs': ['academic', 'homework', 'attendance', 'fees', 'communication', 'behaviour'],
        },
        'examAverage': 82,
        'homeworkCompletion': 90,
        'performanceRate': 86,
        'currentRank': 4,
        'academicAnalytics': {
          'exams': [
            {'examName': 'Unit Test 1', 'subject': 'Maths', 'marks': '42/50', 'percentage': 84},
          ],
          'subjects': [
            {'subject': 'Maths', 'studentAverage': 84, 'classAverage': 70},
          ],
        },
        'attendanceAnalytics': {
          'metrics': {'attendancePercentage': 95, 'totalDays': 40, 'absences': 2, 'leaves': 1},
        },
        // No feeAssignments for a teacher — only the summary.
        'feeAssignments': [],
        'feeSummary': {'totalPayable': 10000, 'totalPaid': 6000, 'balance': 4000, 'status': 'OVERDUE'},
      });
}

Future<void> _pump(WidgetTester tester) async {
  // Wide enough that the horizontal, lazily-built tab strip lays out every pill.
  tester.view.physicalSize = const Size(2400, 2400);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    Provider<TeacherRepository>.value(
      value: _FakeRepository(),
      child: const MaterialApp(home: StudentProfileScreen(studentId: 's1')),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the server-allowed tabs for a teacher, without documents', (tester) async {
    await _pump(tester);

    expect(find.text('Aditya Parikh'), findsOneWidget);
    expect(find.text('Overview'), findsOneWidget);
    expect(find.text('Academics'), findsOneWidget);
    // "Attendance" is also a quick-action and a KPI label, so it repeats.
    expect(find.text('Attendance'), findsWidgets);
    expect(find.text('Fees'), findsOneWidget);
    // Teachers never get a documents tab.
    expect(find.text('Documents'), findsNothing);
  });

  testWidgets('fees tab shows a balance summary only — no ledger or payments', (tester) async {
    await _pump(tester);

    await tester.tap(find.text('Fees'));
    await tester.pumpAndSettle();

    expect(find.text('Overdue'), findsOneWidget);
    expect(find.text('Balance'), findsOneWidget);
    // A teacher must not get the principal's payment history or ledger.
    expect(find.text('Open Fee Ledger'), findsNothing);
    expect(find.text('Recent Payments'), findsNothing);
  });
}
