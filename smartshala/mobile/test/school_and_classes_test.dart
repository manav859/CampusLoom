import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/classes/class_detail_screen.dart';
import 'package:smartshala_mobile/features/principal/classes/class_form_screen.dart';
import 'package:smartshala_mobile/features/principal/classes/classes_screen.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/school_models.dart';
import 'package:smartshala_mobile/features/principal/data/student_models.dart' show StudentCounts;
import 'package:smartshala_mobile/features/principal/data/teacher_models.dart';
import 'package:smartshala_mobile/features/principal/school/edit_school_profile_screen.dart';
import 'package:smartshala_mobile/features/principal/school/school_profile_screen.dart';
import 'package:smartshala_mobile/features/principal/subjects/subjects_screen.dart';

// A 1x1 transparent PNG, as the web stores a resized logo.
const _logo =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

Map<String, dynamic> _classJson(String id, String name, String section, {List<String> subjects = const ['English', 'Mathematics'], String? teacherId = 't1', int students = 30}) => {
      'id': id,
      'name': name,
      'section': section,
      'academicYear': '2026-27',
      'classTeacherId': teacherId,
      'classTeacher': teacherId == null ? null : {'id': teacherId, 'fullName': 'Asha Rao', 'phone': '9000000001'},
      'maximumStrength': 40,
      'stream': null,
      'mediumOfInstruction': 'English',
      'subjects': [
        for (var i = 0; i < subjects.length; i++) {'id': '$id-s$i', 'name': subjects[i], 'teacherId': teacherId},
      ],
      '_count': {'students': students},
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  final profileUpdates = <Map<String, dynamic>>[];
  final created = <ClassDraft>[];
  final updated = <(String, ClassDraft)>[];
  final subjectUpdates = <(String, List<String>)>[];
  String? currentYear = '2025-26';
  ApiException? subjectError;

  @override
  Future<SchoolProfile> schoolProfile() async => SchoolProfile.fromJson({
        'name': 'Noble Public School',
        'code': 'DEMO-SCHOOL',
        'city': 'Jaipur',
        'state': 'Rajasthan',
        'phone': '0141-2222222',
        'udiseNumber': '08123456789',
        'affiliationBoard': 'CBSE',
        'logoUrl': _logo,
        'timetablePeriodCount': 7,
      });

  @override
  Future<SchoolProfile> updateSchoolProfile(Map<String, dynamic> body) async {
    profileUpdates.add(body);
    return SchoolProfile.fromJson({...body, 'code': 'DEMO-SCHOOL'});
  }

  @override
  Future<StudentCounts> studentCounts() async => const StudentCounts(active: 412, inactive: 9);

  @override
  Future<TeacherCounts> teacherCounts() async => throw ApiException(message: 'offline', code: 'NETWORK_ERROR');

  @override
  Future<List<ClassRow>> classRows() async => [
        ClassRow.fromJson(_classJson('c1', '6', 'A')),
        ClassRow.fromJson(_classJson('c2', '7', 'B', subjects: ['Science'], teacherId: null, students: 12)),
      ];

  @override
  Future<String?> currentAcademicYear() async => currentYear;

  @override
  Future<List<TeacherRow>> teachers({bool inactive = false}) async => [
        TeacherRow.fromJson({'id': 't1', 'fullName': 'Asha Rao', 'phone': '9000000001', 'status': 'ACTIVE'}),
        TeacherRow.fromJson({'id': 't2', 'fullName': 'Vikram Shah', 'phone': '9000000002', 'status': 'ACTIVE'}),
      ];

  @override
  Future<void> createClass(ClassDraft draft) async => created.add(draft);

  @override
  Future<void> updateClass(String id, ClassDraft draft) async => updated.add((id, draft));

  @override
  Future<void> updateClassSubjects(String id, List<String> subjects) async {
    subjectUpdates.add((id, subjects));
    final error = subjectError;
    if (error != null) throw error;
  }

  @override
  Future<ClassRow> classDetail(String id) async => ClassRow.fromJson(_classJson(id, '6', 'A'));

  @override
  Future<ClassStats> classStats(String id) async =>
      ClassStats.fromJson({'attendancePercent': 91, 'marksAveragePercent': 74, 'feeCollectionPercent': 60, 'attendanceWindowDays': 30});

  @override
  Future<List<ClassStudent>> classStudents(String id) async => [
        ClassStudent.fromJson({'id': 's1', 'fullName': 'Aarav Mehta', 'admissionNumber': 'ADM-1', 'rollNumber': 1}),
      ];
}

Future<_FakeRepository> _pump(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1, _FakeRepository? repository}) async {
  tester.view.physicalSize = Size(width * 2, 6000);
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
  group('School and class rules', () {
    test('a profile save sends the logo and periods back unchanged', () {
      final profile = SchoolProfile.fromJson({'name': 'Old', 'code': 'X', 'logoUrl': _logo, 'timetablePeriodCount': 7});
      expect(
        profile.updateJson(name: ' New Name ', city: ' ', state: 'Rajasthan', phone: null, udiseNumber: '', affiliationBoard: 'ICSE'),
        {
          'name': 'New Name',
          'city': null,
          'state': 'Rajasthan',
          'phone': null,
          'udiseNumber': null,
          'affiliationBoard': 'ICSE',
          'logoUrl': _logo,
          'timetablePeriodCount': 7,
        },
      );
    });

    test('class drafts dedupe subjects and keep the academic year out of an edit', () {
      const draft = ClassDraft(
        name: ' 9 ',
        section: 'C',
        academicYear: '2026-27',
        classTeacherId: 't1',
        mediumOfInstruction: 'Hindi',
        subjects: ['English', ' english', 'Maths ', ''],
        maximumStrength: 35,
        stream: ' ',
      );
      expect(draft.toJson(), {
        'name': '9',
        'section': 'C',
        'academicYear': '2026-27',
        'classTeacherId': 't1',
        'mediumOfInstruction': 'Hindi',
        'subjects': ['English', 'Maths'],
        'maximumStrength': 35,
      });
      final edit = draft.toJson(forUpdate: true);
      expect(edit.containsKey('academicYear'), isFalse);
      expect(edit['stream'], isNull, reason: 'clearing the stream on an edit sends null');
      expect(edit.containsKey('stream'), isTrue);
      expect(fallbackAcademicYear(DateTime(2026, 9, 14)), '2026-27');
    });
  });

  group('School Profile', () {
    testWidgets('shows the profile, and a stat that failed stays blank', (tester) async {
      await _pump(tester, const SchoolProfileScreen());
      expect(find.text('Noble Public School'), findsWidgets);
      expect(find.text('DEMO-SCHOOL'), findsWidgets);
      expect(find.text('412'), findsOneWidget);
      expect(find.text('—'), findsOneWidget, reason: 'the teacher count failed');
      expect(find.text('Jaipur, Rajasthan'), findsOneWidget);
      expect(find.byType(Image), findsOneWidget, reason: 'the data URL logo is drawn');
    });

    testWidgets('edit saves the changed fields and keeps the logo', (tester) async {
      final repo = _FakeRepository();
      await _pump(tester, EditSchoolProfileScreen(profile: await repo.schoolProfile()), repository: repo);
      await tester.enterText(find.widgetWithText(TextFormField, 'City'), 'Udaipur');
      await tester.tap(find.text('Save profile'));
      await tester.pumpAndSettle();
      expect(repo.profileUpdates.single['city'], 'Udaipur');
      expect(repo.profileUpdates.single['logoUrl'], _logo);
      expect(repo.profileUpdates.single['timetablePeriodCount'], 7);
    });
  });

  group('Classes & Sections', () {
    testWidgets('lists classes with totals and searches by teacher', (tester) async {
      await _pump(tester, const ClassesScreen());
      expect(find.byType(ClassCard), findsNWidgets(2));
      expect(find.text('42'), findsOneWidget, reason: 'students across classes');
      await tester.enterText(find.byType(TextField), 'asha');
      await tester.pumpAndSettle();
      expect(find.byType(ClassCard), findsOneWidget);
      expect(find.text('Class 6-A'), findsOneWidget);
    });

    testWidgets('a new class goes in the current academic year with the default subjects', (tester) async {
      final repo = await _pump(tester, const ClassFormScreen());
      expect(find.text('2025-26'), findsOneWidget);

      await tester.tap(find.text('Create Class'));
      await tester.pumpAndSettle();
      expect(find.text('Choose a class teacher'), findsOneWidget);
      expect(repo.created, isEmpty);

      await tester.enterText(find.widgetWithText(TextFormField, 'Class name *'), '9');
      await tester.enterText(find.widgetWithText(TextFormField, 'Section *'), 'C');
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Class teacher *'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Vikram Shah').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilterChip, 'Hindi'));
      await tester.enterText(find.widgetWithText(TextField, 'Add another subject'), 'Robotics');
      await tester.tap(find.byTooltip('Add subject'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create Class'));
      await tester.pumpAndSettle();

      final draft = repo.created.single;
      expect(draft.academicYear, '2025-26');
      expect(draft.classTeacherId, 't2');
      expect(draft.subjects, ['English', 'Mathematics', 'Science', 'Social Studies', 'Robotics']);
    });

    testWidgets('without a current academic year the web’s default is used', (tester) async {
      final repo = _FakeRepository()..currentYear = null;
      await _pump(tester, const ClassFormScreen(), repository: repo);
      expect(find.text(fallbackAcademicYear(DateTime.now())), findsOneWidget);
    });

    testWidgets('class detail shows stats, subjects and students, and edits', (tester) async {
      final repo = await _pump(tester, const ClassDetailScreen(classId: 'c1'));
      expect(find.text('91%'), findsOneWidget);
      expect(find.text('Aarav Mehta'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);

      await tester.tap(find.byTooltip('Edit class'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Max strength'), '45');
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();
      expect(repo.updated.single.$1, 'c1');
      expect(repo.updated.single.$2.maximumStrength, 45);
      expect(repo.updated.single.$2.subjects, ['English', 'Mathematics']);
    });
  });

  group('Subjects', () {
    testWidgets('adds a subject to one class', (tester) async {
      final repo = await _pump(tester, const SubjectsScreen());
      await tester.tap(find.widgetWithText(TextButton, 'Add').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Subject name'), 'Computer Science');
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      expect(repo.subjectUpdates.single.$1, 'c1');
      expect(repo.subjectUpdates.single.$2, ['English', 'Mathematics', 'Computer Science']);
      expect(find.text('Computer Science added to Class 6-A.'), findsOneWidget);
    });

    testWidgets('a removal the server refuses shows its reason', (tester) async {
      final repo = _FakeRepository()
        ..subjectError = ApiException(
          message: "Mathematics already has exams, homework or timetable periods, so it can't be removed.",
          code: 'SUBJECT_IN_USE',
          statusCode: 409,
        );
      await _pump(tester, const SubjectsScreen(), repository: repo);
      await tester.tap(find.byTooltip('Remove Mathematics'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Remove'));
      await tester.pumpAndSettle();
      expect(repo.subjectUpdates.single.$1, 'c1');
      expect(repo.subjectUpdates.single.$2, ['English']);
      expect(find.text("Mathematics already has exams, homework or timetable periods, so it can't be removed."), findsOneWidget);
    });

    testWidgets('the last subject of a class is never removed', (tester) async {
      final repo = await _pump(tester, const SubjectsScreen());
      await tester.tap(find.byTooltip('Remove Science'));
      await tester.pumpAndSettle();
      expect(find.text('A class needs at least one subject.'), findsOneWidget);
      expect(repo.subjectUpdates, isEmpty);
    });
  });

  for (final (name, screen) in [
    ('School Profile', const SchoolProfileScreen()),
    ('Classes', const ClassesScreen()),
    ('Class form', const ClassFormScreen()),
    ('Class detail', const ClassDetailScreen(classId: 'c1')),
    ('Subjects', const SubjectsScreen()),
  ]) {
    testWidgets('$name lays out at 320dp with 1.3x text', (tester) async {
      await _pump(tester, screen, width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
    });
  }
}
