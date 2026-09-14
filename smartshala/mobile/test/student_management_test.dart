import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/widgets/app_chips.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/student_models.dart';
import 'package:smartshala_mobile/features/principal/students/add_student_screen.dart';
import 'package:smartshala_mobile/features/principal/students/student_export.dart';
import 'package:smartshala_mobile/features/principal/students/student_management_screen.dart';
import 'package:smartshala_mobile/features/principal/students/student_profile_screen.dart';

Map<String, dynamic> _row(int n, {List<Map<String, dynamic>>? fees, num outstanding = 0, bool active = true}) => {
      'id': 's$n',
      'fullName': 'Student $n',
      'admissionNumber': 'ADM-$n',
      'classId': 'c1',
      'rollNumber': n,
      'parentPhone': '98765000${n.toString().padLeft(2, '0')}',
      'isActive': active,
      'class': {'id': 'c1', 'name': '6', 'section': 'A'},
      'attendancePercentage': 90,
      'feeAssignments': fees ?? const [],
      'currentOutstanding': outstanding,
    };

/// Serves [total] students 20 per page, and records every query.
class _FakeRepository extends Fake implements PrincipalRepository {
  _FakeRepository();

  static const total = 25;
  final queries = <Map<String, Object?>>[];
  final created = <NewStudent>[];
  final deactivated = <String>[];

  @override
  Future<StudentCounts> studentCounts() async => const StudentCounts(active: 25, inactive: 4);

  @override
  Future<List<ClassChoice>> classes() async => const [
        ClassChoice(id: 'c1', name: '6', section: 'A'),
        ClassChoice(id: 'c2', name: '7', section: 'B'),
      ];

  @override
  Future<StudentPage> students({
    int page = 1,
    int limit = 20,
    String? search,
    String? classId,
    FeeStatus? feeStatus,
    bool inactive = false,
  }) async {
    queries.add({'page': page, 'search': search, 'classId': classId, 'feeStatus': feeStatus, 'inactive': inactive});
    final start = (page - 1) * limit;
    final count = (total - start).clamp(0, limit);
    return StudentPage(
      items: [for (var i = 0; i < count; i++) StudentRow.fromJson(_row(start + i + 1))],
      total: total,
      page: page,
    );
  }

  @override
  Future<StudentDetail> student(String id) async => StudentDetail.fromJson(_detailJson(allowFees: true));

  @override
  Future<String> createStudent(NewStudent student) async {
    created.add(student);
    return 'new-id';
  }

  @override
  Future<void> deactivateStudent(String id) async => deactivated.add(id);
}

Map<String, dynamic> _detailJson({required bool allowFees}) => {
      ..._row(1, fees: null),
      'gender': 'FEMALE',
      'dateOfBirth': '2014-05-02T00:00:00.000Z',
      'joiningDate': '2024-06-01T00:00:00.000Z',
      'parentName': 'Asha Sharma',
      'fatherName': 'Ravi Sharma',
      'fatherPhone': '9876512345',
      'class': {'id': 'c1', 'name': '6', 'section': 'A', 'academicYear': '2026-27'},
      'access': {
        'role': 'PRINCIPAL',
        'allowedTabs': ['academic', 'attendance', if (allowFees) 'fees', 'documents'],
      },
      'examAverage': 81,
      'performanceRate': 84,
      'attendanceAnalytics': {
        'metrics': {'attendancePercentage': 92, 'totalDays': 50, 'absences': 4, 'late': 1, 'halfDays': 0, 'remainingBefore75': 8, 'classAverageAttendance': 88},
      },
      'academicAnalytics': {
        'exams': [
          {'examName': 'Unit Test 1', 'subject': 'Maths', 'marks': '42/50', 'percentage': 84, 'grade': 'A', 'examDate': '2026-08-10T00:00:00.000Z'},
        ],
        'subjects': [
          {'subject': 'Maths', 'studentAverage': 84, 'classAverage': 71},
        ],
      },
      'feeBalance': 15000,
      'feeAssignments': [
        {
          'totalAmount': '30000',
          'paidAmount': '15000',
          'pendingAmount': '15000',
          'status': 'PARTIAL',
          'feeStructure': {'name': 'Annual Fee 2026-27'},
          'payments': [
            {'amount': '15000', 'mode': 'CASH', 'paidAt': '2026-04-19T10:00:00.000Z', 'receipt': {'receiptNo': 'R-0001'}},
          ],
        },
      ],
      'documents': [
        {'name': 'Birth certificate', 'type': 'BIRTH_CERTIFICATE', 'uploadedAt': '2026-06-02T00:00:00.000Z'},
      ],
      'siblings': [
        {'id': 's9', 'fullName': 'Student 9', 'class': {'name': '9', 'section': 'B'}},
      ],
    };

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
  group('StudentRow fee status, as the web derives it', () {
    StudentRow row({List<Map<String, dynamic>>? fees, num outstanding = 0}) =>
        StudentRow.fromJson(_row(1, fees: fees, outstanding: outstanding));

    test('paid when nothing is pending', () {
      expect(row(fees: [{'pendingAmount': '0', 'status': 'PAID'}]).feeStatus, FeeStatus.paid);
    });
    test('pending while a balance remains', () {
      final student = row(fees: [{'pendingAmount': '15000', 'status': 'PARTIAL'}]);
      expect(student.feeStatus, FeeStatus.pending);
      expect(student.pendingAmount, 15000);
    });
    test('overdue when anything is due now, or an assignment is overdue', () {
      expect(row(fees: [{'pendingAmount': '100', 'status': 'PARTIAL'}], outstanding: 100).feeStatus, FeeStatus.overdue);
      expect(row(fees: [{'pendingAmount': '0', 'status': 'OVERDUE'}]).feeStatus, FeeStatus.overdue);
    });
    test('no status at all when the response has no fee data', () {
      final json = _row(1)..remove('feeAssignments');
      expect(StudentRow.fromJson(json).feeStatus, isNull);
    });
  });

  test('CSV export matches the web columns and quoting', () {
    final csv = studentsCsv([
      StudentRow.fromJson({..._row(1, fees: [{'pendingAmount': '15000', 'status': 'PARTIAL'}]), 'fullName': 'Riya "RJ" Patel'}),
      StudentRow.fromJson(_row(2)..remove('feeAssignments')..['attendancePercentage'] = null),
    ]);
    expect(csv.split('\n'), [
      '"Admission No","Student Name","Class","Parent Phone","Fee Status","Pending Amount","Attendance"',
      '"ADM-1","Riya ""RJ"" Patel","6-A","9876500001","pending","15000","90%"',
      '"ADM-2","Student 2","6-A","9876500002","","",""',
    ]);
  });

  test('WhatsApp link uses the last ten digits with the 91 prefix', () {
    expect(whatsAppUri('9876500001').toString(), 'https://wa.me/919876500001');
    expect(whatsAppUri('+91 98765-00001').toString(), 'https://wa.me/919876500001');
  });

  test('a new student leaves blank optional fields out, like the web form', () {
    final json = NewStudent(
      classId: 'c1',
      fullName: '  Meera Iyer ',
      parentName: 'Lakshmi',
      parentPhone: '9876500011',
      admissionNumber: '  ',
      gender: 'FEMALE',
      dateOfBirth: DateTime(2015, 3, 9),
      address: '',
    ).toJson();
    expect(json['fullName'], 'Meera Iyer');
    expect(json.containsKey('admissionNumber'), isFalse, reason: 'the server generates it');
    expect(json.containsKey('address'), isFalse);
    expect(json['dateOfBirth'], '2015-03-09');
  });

  group('Student Management screen', () {
    testWidgets('shows the tiles and pages through the list', (tester) async {
      final repo = await _pump(tester, const StudentManagementScreen());

      expect(find.text('29'), findsOneWidget, reason: 'total = active + inactive');
      expect(find.text('Showing 20 of 25'), findsOneWidget);
      expect(find.text('Student 20'), findsOneWidget);
      expect(find.text('Student 21'), findsNothing);

      await tester.tap(find.text('Load More'));
      await tester.pumpAndSettle();

      expect(repo.queries.last['page'], 2);
      expect(find.text('Showing 25 of 25'), findsOneWidget);
      expect(find.text('Student 25'), findsOneWidget);
      expect(find.text('Load More'), findsNothing, reason: 'nothing left to load');
    });

    testWidgets('search waits for typing to pause, then restarts at page 1', (tester) async {
      final repo = await _pump(tester, const StudentManagementScreen());
      final before = repo.queries.length;

      await tester.enterText(find.byType(TextField), 'Riy');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(find.byType(TextField), 'Riya');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(repo.queries.length, before + 1, reason: 'one request for the pause, not one per keystroke');
      expect(repo.queries.last, containsPair('search', 'Riya'));
      expect(repo.queries.last, containsPair('page', 1));
    });

    testWidgets('class, fee status and inactive filters reach the query', (tester) async {
      final repo = await _pump(tester, const StudentManagementScreen());

      await tester.tap(find.text('All Classes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7-B'));
      await tester.pumpAndSettle();
      expect(repo.queries.last['classId'], 'c2');

      await tester.tap(find.text('All Fee Statuses'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Overdue Fees'));
      await tester.pumpAndSettle();
      expect(repo.queries.last['feeStatus'], FeeStatus.overdue);
      expect(repo.queries.last['classId'], 'c2', reason: 'filters combine');

      await tester.tap(find.descendant(of: find.byType(SegmentedTabs), matching: find.text('Inactive')));
      await tester.pumpAndSettle();
      expect(repo.queries.last['inactive'], true);
    });

    testWidgets('a fee filter hides rows whose derived status differs, as the web does', (tester) async {
      final repo = await _pump(tester, const StudentManagementScreen(), repository: _FakePendingMix());

      await tester.tap(find.text('All Fee Statuses'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pending Fees'));
      await tester.pumpAndSettle();

      // The server's Pending page holds 20 rows; every third is due now, so derived Overdue.
      expect(find.text('Showing 13 with pending fees'), findsOneWidget);
      expect(find.text('Overdue'), findsNothing);
      expect(find.text('Load More'), findsOneWidget, reason: 'paging counts server rows, 20 of 25');

      await tester.tap(find.text('Load More'));
      await tester.pumpAndSettle();
      expect(repo.queries.last['page'], 2);
      expect(find.text('Load More'), findsNothing);
    });

    // A layout overflow fails a widget test, so reaching the end proves it fits.
    testWidgets('fits a small phone with large text and a tablet', (tester) async {
      await _pump(tester, const StudentManagementScreen(), width: 320, textScale: 1.3);
      expect(find.text('Student 1'), findsOneWidget);
    });

    testWidgets('fits a tablet', (tester) async {
      await _pump(tester, const StudentManagementScreen(), width: 1200);
      expect(find.text('Student 1'), findsOneWidget);
    });
  });

  group('Student profile', () {
    testWidgets('tabs follow the server and Fees shows the balance and payments', (tester) async {
      await _pump(tester, const PrincipalStudentProfileScreen(studentId: 's1'));

      // The pills scroll sideways on a phone, so later tabs may be built but off-screen.
      for (final label in ['Overview', 'Academics', 'Attendance', 'Fees', 'Documents']) {
        expect(find.text(label, skipOffstage: false), findsWidgets, reason: label);
      }
      expect(find.text('Ravi Sharma · 9876512345'), findsOneWidget);
      expect(find.text('Student 9'), findsOneWidget);

      // Left to right, because the helper scrolls the pill row forward.
      await _openTab(tester, 'Academics');
      expect(find.text('42/50'), findsOneWidget);
      expect(find.text('84% · class 71%'), findsOneWidget);

      await _openTab(tester, 'Fees');
      expect(find.text('Annual Fee 2026-27'), findsOneWidget);
      expect(find.text('Cash · Receipt R-0001'), findsOneWidget);
    });

    testWidgets('no Fees tab when the server does not allow it', (tester) async {
      final repo = _FakeRestricted();
      await _pump(tester, const PrincipalStudentProfileScreen(studentId: 's1'), repository: repo);
      expect(find.text('Fees', skipOffstage: false), findsNothing);
      expect(find.text('Academics', skipOffstage: false), findsOneWidget);
    });

    testWidgets('deactivating asks first, then calls the API', (tester) async {
      final repo = await _pump(tester, const PrincipalStudentProfileScreen(studentId: 's1'));

      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Deactivate student'));
      await tester.pumpAndSettle();
      expect(repo.deactivated, isEmpty, reason: 'nothing happens before confirming');

      await tester.tap(find.widgetWithText(TextButton, 'Deactivate'));
      await tester.pumpAndSettle();
      expect(repo.deactivated, ['s1']);
    });

    testWidgets('fits a small phone with large text', (tester) async {
      await _pump(tester, const PrincipalStudentProfileScreen(studentId: 's1'), width: 320, textScale: 1.3);
      await _openTab(tester, 'Fees');
      expect(find.text('Annual Fee 2026-27'), findsOneWidget);
    });
  });

  group('Add Student', () {
    testWidgets('names every missing required field before calling the API', (tester) async {
      final repo = await _pump(tester, const AddStudentScreen());

      await tester.tap(find.widgetWithText(FilledButton, 'Add Student'));
      await tester.pumpAndSettle();

      expect(find.text('Enter the student’s full name'), findsOneWidget);
      expect(find.text('Choose a class'), findsOneWidget);
      expect(find.text('Choose a gender'), findsOneWidget);
      expect(find.text('Enter the parent’s name'), findsOneWidget);
      expect(find.text('Enter a 10-digit phone number'), findsOneWidget);
      expect(repo.created, isEmpty);
    });

    testWidgets('saves a valid student', (tester) async {
      final repo = await _pump(tester, const AddStudentScreen());

      await tester.enterText(find.widgetWithText(TextFormField, 'Full name *'), 'Meera Iyer');
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Class *'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7-B').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Gender *'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Female').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Parent name *'), 'Lakshmi Iyer');
      await tester.enterText(find.widgetWithText(TextFormField, 'Parent phone *'), '9876500011');

      await tester.tap(find.widgetWithText(FilledButton, 'Add Student'));
      await tester.pumpAndSettle();

      expect(repo.created, hasLength(1));
      expect(repo.created.single.classId, 'c2');
      expect(repo.created.single.gender, 'FEMALE');
    });
  });
}

Future<void> _openTab(WidgetTester tester, String label) async {
  final tab = find.descendant(of: find.byType(SegmentedTabs), matching: find.text(label));
  await tester.scrollUntilVisible(
    tab,
    80,
    scrollable: find.descendant(of: find.byType(SegmentedTabs), matching: find.byType(Scrollable)),
  );
  await tester.pumpAndSettle();
  await tester.tap(tab);
  await tester.pumpAndSettle();
}

/// A Pending page where every third student also has money due now.
class _FakePendingMix extends _FakeRepository {
  @override
  Future<StudentPage> students({
    int page = 1,
    int limit = 20,
    String? search,
    String? classId,
    FeeStatus? feeStatus,
    bool inactive = false,
  }) async {
    final base = await super.students(page: page, limit: limit, search: search, classId: classId, feeStatus: feeStatus, inactive: inactive);
    if (feeStatus == null) return base;
    final start = (page - 1) * limit;
    return StudentPage(
      total: base.total,
      page: page,
      items: [
        for (var i = 0; i < base.items.length; i++)
          StudentRow.fromJson(_row(start + i + 1, fees: [{'pendingAmount': '500', 'status': 'PARTIAL'}], outstanding: (start + i) % 3 == 0 ? 500 : 0)),
      ],
    );
  }
}

class _FakeRestricted extends _FakeRepository {
  @override
  Future<StudentDetail> student(String id) async => StudentDetail.fromJson(_detailJson(allowFees: false));
}
