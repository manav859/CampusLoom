import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/features/teacher/attendance/mark_attendance_screen.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';

/// Attendance belongs to the class teacher. GET /classes without a scope also
/// returns the classes a teacher only takes periods in, and GET
/// /attendance/roster answers 404 "Class not found" for those — which is what
/// the screen used to show instead of the day's roster.
class _FakeRepository extends Fake implements TeacherRepository {
  _FakeRepository({this.holidayReason});

  final String? holidayReason;
  bool? requestedClassTeacherOnly;

  @override
  Future<List<ClassOption>> myClasses({bool classTeacherOnly = false}) async {
    requestedClassTeacherOnly = classTeacherOnly;
    return [
      if (classTeacherOnly)
        const ClassOption(id: 'own', name: '5', section: 'A')
      else ...[
        const ClassOption(id: 'periods-only', name: '9', section: 'C'),
        const ClassOption(id: 'own', name: '5', section: 'A'),
      ],
    ];
  }

  @override
  Future<AttendanceRoster> roster({required String classId, required DateTime date}) async {
    if (classId != 'own') {
      throw ApiException(message: 'Class not found', code: 'NOT_FOUND', statusCode: 404);
    }
    return AttendanceRoster.fromJson({
      'className': '5-A',
      'canEdit': holidayReason == null,
      'isHoliday': holidayReason != null,
      'holidayReason': holidayReason,
      'students': [
        {'id': 's1', 'fullName': 'Aarav Mehta', 'rollNumber': 1, 'defaultStatus': 'PRESENT'},
      ],
    });
  }
}

Future<_FakeRepository> _pump(WidgetTester tester, {String? holidayReason}) async {
  tester.view.physicalSize = const Size(780, 5000);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.resetPhysicalSize);

  final repository = _FakeRepository(holidayReason: holidayReason);
  await tester.pumpWidget(
    Provider<TeacherRepository>.value(
      value: repository,
      child: const MaterialApp(home: MarkAttendanceScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return repository;
}

void main() {
  testWidgets('only offers the classes this teacher may actually mark', (tester) async {
    final repository = await _pump(tester);

    expect(repository.requestedClassTeacherOnly, isTrue);
    expect(find.text('Class not found'), findsNothing);
    expect(find.text('Aarav Mehta'), findsOneWidget);
  });

  testWidgets('a Sunday says so instead of erroring', (tester) async {
    await _pump(tester, holidayReason: 'Sunday');

    expect(find.textContaining('Sunday'), findsOneWidget);
    expect(find.textContaining('attendance cannot be marked'), findsOneWidget);
    expect(find.text('Attendance locked'), findsOneWidget);
  });
}
