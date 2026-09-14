import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/widgets/app_chips.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/teacher_models.dart';
import 'package:smartshala_mobile/features/principal/teachers/add_teacher_screen.dart';
import 'package:smartshala_mobile/features/principal/teachers/teacher_management_screen.dart';
import 'package:smartshala_mobile/features/principal/teachers/teacher_profile_screen.dart';

Map<String, dynamic> _period(String day, int number, {String? classId, String className = 'Free period', String? subjectId, String subjectName = 'Free period'}) => {
      'id': '$day-$number',
      'dayOfWeek': day,
      'periodNumber': number,
      'classId': classId,
      'subjectId': subjectId,
      'className': className,
      'subjectName': subjectName,
    };

/// Teacher n teaches Maths in 6-A on Monday period 1; every third also teaches
/// Science in 7-B and is class teacher of 7-B.
Map<String, dynamic> _teacher(int n, {bool active = true}) => {
      'id': 't$n',
      'fullName': 'Teacher ${n.toString().padLeft(2, '0')}',
      'email': n == 1 ? 'first@school.in' : null,
      'phone': '98765100${n.toString().padLeft(2, '0')}',
      'status': active ? 'ACTIVE' : 'INACTIVE',
      'timetablePeriodCount': 8,
      'createdAt': '2026-06-01T04:00:00.000Z',
      'periodAssignments': [
        _period('MONDAY', 1, classId: 'c1', className: '6-A', subjectId: 'm', subjectName: 'Maths'),
        _period('MONDAY', 2),
        if (n % 3 == 0) _period('TUESDAY', 1, classId: 'c2', className: '7-B', subjectId: 's', subjectName: 'Science'),
      ],
      'classTeacherFor': [
        if (n % 3 == 0) {'id': 'c2', 'name': '7', 'section': 'B'},
      ],
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  final listQueries = <bool>[];
  final created = <NewTeacher>[];
  final updated = <String>[];
  final deactivated = <String>[];
  bool attendanceFails = false;

  @override
  Future<TeacherCounts> teacherCounts() async => const TeacherCounts(active: 25, inactive: 2);

  @override
  Future<List<TeacherRow>> teachers({bool inactive = false}) async {
    listQueries.add(inactive);
    return inactive
        ? [for (var n = 26; n <= 27; n++) TeacherRow.fromJson(_teacher(n, active: false))]
        : [for (var n = 1; n <= 25; n++) TeacherRow.fromJson(_teacher(n))];
  }

  @override
  Future<TeacherRow> teacher(String id) async => TeacherRow.fromJson({
        ..._teacher(3),
        'email': 'three@school.in',
        'academicBackground': 'M.Sc. Physics, B.Ed.',
      });

  @override
  Future<TeacherAttendanceSummary> teacherAttendance(String id, DateTime month) async {
    if (attendanceFails) throw ApiException(message: 'Staff member not found', code: 'NOT_FOUND', statusCode: 404);
    return TeacherAttendanceSummary.fromJson(
      {'workingDays': 10, 'presentDays': 7, 'leaveDays': 2, 'absentDays': 1, 'percentage': 70},
    );
  }

  @override
  Future<void> createTeacher(NewTeacher teacher) async => created.add(teacher);

  @override
  Future<void> updateTeacher(String id, {required String fullName, required String phone, required String email}) async =>
      updated.add('$id:$fullName');

  @override
  Future<void> deactivateTeacher(String id) async => deactivated.add(id);
}

Future<_FakeRepository> _pump(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1, _FakeRepository? repository}) async {
  tester.view.physicalSize = Size(width * 2, 7000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repo = repository ?? _FakeRepository();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repo,
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  group('TeacherRow, as the web Teachers page derives it', () {
    test('subjects and classes are distinct, sorted and skip free periods', () {
      final teacher = TeacherRow.fromJson({
        ..._teacher(3),
        'periodAssignments': [
          _period('TUESDAY', 1, classId: 'c2', className: '7-B', subjectId: 's', subjectName: 'Science'),
          _period('MONDAY', 1, classId: 'c1', className: '6-A', subjectId: 'm', subjectName: 'Maths'),
          _period('MONDAY', 3, classId: 'c1', className: '6-A', subjectId: 'm', subjectName: 'Maths'),
          _period('MONDAY', 2),
        ],
      });
      expect(teacher.subjects, ['Maths', 'Science']);
      expect(teacher.classes, ['6-A', '7-B']);
      expect(teacher.classTeacherLabel, '7-B');
      expect(TeacherRow.fromJson(_teacher(1)).classTeacherLabel, 'None');
    });

    test('periods count like assignedPeriodCount: a class, Monday to Saturday, within the period count', () {
      final teacher = TeacherRow.fromJson({
        ..._teacher(1),
        'timetablePeriodCount': 6,
        'periodAssignments': [
          _period('MONDAY', 1, classId: 'c1'),
          _period('SATURDAY', 6, classId: 'c1'),
          _period('MONDAY', 7, classId: 'c1'), // beyond the school's 6 periods
          _period('SUNDAY', 1, classId: 'c1'),
          _period('MONDAY', 2), // free
        ],
      });
      expect(teacher.assignedPeriods, 2);
      expect(teacher.totalSlots, 36);
    });

    test('search matches name, phone or email, like the server', () {
      final teacher = TeacherRow.fromJson(_teacher(1));
      expect(teacher.matches('teacher 01'), isTrue);
      expect(teacher.matches('5100'), isTrue);
      expect(teacher.matches('FIRST@'), isTrue);
      expect(teacher.matches('nobody'), isFalse);
    });
  });

  test('a new teacher leaves blank optional fields out; an edit clears a blank email', () {
    final json = const NewTeacher(fullName: ' Anita Rao ', phone: '9876500000 ', password: 'secret1', email: ' ').toJson();
    expect(json, {'fullName': 'Anita Rao', 'phone': '9876500000', 'password': 'secret1'});
    expect(teacherUpdateJson(fullName: 'A', phone: '9876500000', email: '  '), containsPair('email', null));
  });

  test('CSV export quotes every cell', () {
    final csv = teachersCsv([
      TeacherRow.fromJson({..._teacher(3), 'fullName': 'Ravi "RK" Kumar'}),
    ]);
    expect(csv.split('\n'), [
      '"Name","Email","Phone","Subjects","Class Teacher","Periods","Status"',
      '"Ravi ""RK"" Kumar","","9876510003","Maths, Science","7-B","2/48","ACTIVE"',
    ]);
  });

  group('Teacher Management screen', () {
    testWidgets('shows the tiles and pages through the list', (tester) async {
      await _pump(tester, const TeacherManagementScreen());

      expect(find.text('27'), findsOneWidget, reason: 'total = active + inactive');
      expect(find.text('Showing 20 of 25'), findsOneWidget);
      expect(find.text('Teacher 20'), findsOneWidget);
      expect(find.text('Teacher 21'), findsNothing);

      await tester.tap(find.text('Load More'));
      await tester.pumpAndSettle();
      expect(find.text('Teacher 25'), findsOneWidget);
      expect(find.text('Load More'), findsNothing);
    });

    testWidgets('search, subject and class teacher filter the loaded list without new requests', (tester) async {
      final repo = await _pump(tester, const TeacherManagementScreen());
      final requests = repo.listQueries.length;

      await tester.tap(find.text('All Subjects'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Science'));
      await tester.pumpAndSettle();
      expect(find.text('Showing 8 of 8'), findsOneWidget, reason: 'teachers 3, 6 … 24');

      await tester.tap(find.text('All Class Teachers'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Class 7-B'));
      await tester.pumpAndSettle();
      expect(find.text('Showing 8 of 8'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'teacher 1');
      await tester.pumpAndSettle();
      expect(find.text('Showing 3 of 3'), findsOneWidget, reason: 'teachers 12, 15 and 18');

      expect(repo.listQueries.length, requests);
    });

    testWidgets('the Inactive tab loads inactive teachers', (tester) async {
      final repo = await _pump(tester, const TeacherManagementScreen());

      await tester.tap(find.descendant(of: find.byType(SegmentedTabs), matching: find.text('Inactive')));
      await tester.pumpAndSettle();

      expect(repo.listQueries.last, isTrue);
      expect(find.text('Teacher 26'), findsOneWidget);
      expect(find.text('Teacher 01'), findsNothing);
    });

    testWidgets('fits a small phone with large text', (tester) async {
      await _pump(tester, const TeacherManagementScreen(), width: 320, textScale: 1.3);
      expect(find.text('Teacher 01'), findsOneWidget);
    });

    testWidgets('fits a tablet', (tester) async {
      await _pump(tester, const TeacherManagementScreen(), width: 1200);
      expect(find.text('Teacher 01'), findsOneWidget);
    });
  });

  group('Teacher profile', () {
    testWidgets('shows basic information, teaching details and the month’s attendance', (tester) async {
      await _pump(tester, const TeacherProfileScreen(teacherId: 't3'));

      expect(find.text('three@school.in'), findsOneWidget);
      expect(find.text('M.Sc. Physics, B.Ed.'), findsOneWidget);
      expect(find.text('Maths, Science'), findsWidgets);
      expect(find.text('6-A, 7-B'), findsOneWidget);
      expect(find.text('7-B'), findsOneWidget, reason: 'class teacher of');
      expect(find.text('2/48 assigned'), findsOneWidget);
      expect(find.text('70%'), findsOneWidget);
      expect(find.text('10 working days so far'), findsOneWidget);
    });

    testWidgets('an attendance failure leaves the rest of the profile usable', (tester) async {
      await _pump(tester, const TeacherProfileScreen(teacherId: 't3'), repository: _FakeRepository()..attendanceFails = true);

      expect(find.text('Staff member not found'), findsOneWidget);
      expect(find.text('6-A, 7-B'), findsOneWidget);
    });

    testWidgets('deactivating asks first, then calls the API', (tester) async {
      final repo = await _pump(tester, const TeacherProfileScreen(teacherId: 't3'));

      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Deactivate teacher'));
      await tester.pumpAndSettle();
      expect(repo.deactivated, isEmpty, reason: 'nothing happens before confirming');

      await tester.tap(find.widgetWithText(TextButton, 'Deactivate'));
      await tester.pumpAndSettle();
      expect(repo.deactivated, ['t3']);
    });

    testWidgets('Edit Profile opens the form filled in and saves', (tester) async {
      final repo = await _pump(tester, const TeacherProfileScreen(teacherId: 't3'));

      await tester.tap(find.text('Edit Profile'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextFormField, 'Teacher 03'), findsOneWidget);
      expect(find.text('Initial password *'), findsNothing, reason: 'editing does not change the password');

      await tester.enterText(find.widgetWithText(TextFormField, 'Teacher 03'), 'Teacher Three');
      await tester.tap(find.widgetWithText(FilledButton, 'Save Changes'));
      await tester.pumpAndSettle();

      expect(repo.updated, ['t3:Teacher Three']);
      expect(find.text('Teacher Profile'), findsOneWidget, reason: 'back on the profile');
    });

    testWidgets('fits a small phone with large text', (tester) async {
      await _pump(tester, const TeacherProfileScreen(teacherId: 't3'), width: 320, textScale: 1.3);
      expect(find.text('70%'), findsOneWidget);
    });
  });

  group('Add Teacher', () {
    testWidgets('names every invalid field before calling the API', (tester) async {
      final repo = await _pump(tester, const AddTeacherScreen());

      await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'not-an-email');
      await tester.tap(find.widgetWithText(FilledButton, 'Add Teacher'));
      await tester.pumpAndSettle();

      expect(find.text('Enter the teacher’s full name'), findsOneWidget);
      expect(find.text('Enter at least 10 digits'), findsOneWidget);
      expect(find.text('Enter a valid email'), findsOneWidget);
      expect(find.text('Use 6 to 72 characters'), findsOneWidget);
      expect(repo.created, isEmpty);
    });

    testWidgets('saves a valid teacher', (tester) async {
      final repo = await _pump(tester, const AddTeacherScreen());

      await tester.enterText(find.widgetWithText(TextFormField, 'Full name *'), 'Anita Rao');
      await tester.enterText(find.widgetWithText(TextFormField, 'Phone *'), '9876500123');
      await tester.enterText(find.widgetWithText(TextFormField, 'Initial password *'), 'secret1');
      await tester.tap(find.widgetWithText(FilledButton, 'Add Teacher'));
      await tester.pumpAndSettle();

      expect(repo.created.single.toJson(), {'fullName': 'Anita Rao', 'phone': '9876500123', 'password': 'secret1'});
    });
  });
}
