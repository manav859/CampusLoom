import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/core/data/exam_models.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/core/widgets/schedule_exam_screen.dart';
import 'package:smartshala_mobile/features/principal/calendar/academic_calendar_screen.dart';
import 'package:smartshala_mobile/features/principal/calendar/event_form_screen.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/student_models.dart' show ClassChoice;
import 'package:smartshala_mobile/features/principal/exams/exam_results_screen.dart';
import 'package:smartshala_mobile/features/principal/exams/exams_screen.dart';
import 'package:smartshala_mobile/features/teacher/data/academics_models.dart' show TeachingClass;
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/marks/marks_screen.dart';

Map<String, dynamic> _examJson(String id, {String name = 'Unit Test 1', String date = '2026-09-01T00:00:00.000Z', int entered = 0, int pending = 3}) => {
      'id': id,
      'classId': 'c1',
      'className': '6-A',
      'subjectId': 'sub1',
      'subject': 'Mathematics',
      'name': name,
      'term': 'UNIT_TEST',
      'maxMarks': 50,
      'passingMarks': null,
      'description': null,
      'date': date,
      'status': 'MARKS_ENTERED',
      'enteredCount': entered,
      'pendingCount': pending,
      'classAverage': entered == 0 ? 0 : 70,
    };

Map<String, dynamic> _contextJson() => {
      'classes': [
        {
          'id': 'c1',
          'name': '6',
          'section': 'A',
          'subjects': [
            {'id': 'sub1', 'name': 'Mathematics'},
            {'id': 'sub2', 'name': 'Science'},
          ],
          'students': [
            {'id': 's1', 'fullName': 'Aarav', 'rollNumber': 1},
          ],
        },
        {
          'id': 'c2',
          'name': '7',
          'section': 'B',
          'subjects': [
            {'id': 'sub3', 'name': 'English'},
          ],
          'students': [],
        },
      ],
    };

ExamDetail _detail() => ExamDetail.fromJson({
      ..._examJson('e1', entered: 1, pending: 1),
      'students': [
        {'studentId': 's1', 'fullName': 'Aarav', 'rollNumber': 1, 'result': {'marks': 45, 'percentage': 90, 'grade': 'A+', 'isAbsent': false}},
        {'studentId': 's2', 'fullName': 'Diya', 'rollNumber': 2, 'result': null},
      ],
    });

Future<void> _setView(WidgetTester tester, {double width = 390, double textScale = 1}) async {
  tester.view.physicalSize = Size(width * 2, 6000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

// ------------------------------------------------------------------ principal

class _FakePrincipal extends Fake implements PrincipalRepository {
  final created = <CalendarEventDraft>[];
  final updated = <(String, CalendarEventDraft)>[];
  final deleted = <String>[];
  final scheduled = <NewExam>[];
  final saved = <(String, double, bool)>[];

  @override
  Future<List<CalendarEvent>> calendarMonth(DateTime month) async => [
        CalendarEvent(
          id: 'h1',
          type: CalendarEventType.holiday,
          title: 'Founders Day',
          startDate: DateTime(month.year, month.month, 10),
          endDate: DateTime(month.year, month.month, 10),
        ),
        CalendarEvent(
          id: 'ev1',
          type: CalendarEventType.meeting,
          title: 'Parent Teacher Meeting',
          startDate: DateTime(month.year, month.month, 20),
          endDate: DateTime(month.year, month.month, 20),
        ),
      ];

  @override
  Future<void> createCalendarEvent(CalendarEventDraft draft) async => created.add(draft);

  @override
  Future<void> updateCalendarEvent(String id, CalendarEventDraft draft) async => updated.add((id, draft));

  @override
  Future<void> deleteCalendarEvent(String id) async => deleted.add(id);

  @override
  Future<List<ClassChoice>> classes() async => const [ClassChoice(id: 'c1', name: '6', section: 'A')];

  @override
  Future<List<ExamSummary>> exams({String? classId}) async => [
        ExamSummary.fromJson(_examJson('e1', entered: 3, pending: 0)),
        ExamSummary.fromJson(_examJson('e2', name: 'Unit Test 2', entered: 1, pending: 2)),
        ExamSummary.fromJson(_examJson('e3', name: 'Half Yearly', date: '2099-10-01T00:00:00.000Z')),
      ];

  @override
  Future<List<ExamClass>> examClasses() async => ExamClass.listFromContext(_contextJson());

  @override
  Future<ExamSummary> scheduleExam(NewExam exam) async {
    scheduled.add(exam);
    return ExamSummary.fromJson(_examJson('new', name: exam.name));
  }

  @override
  Future<ExamDetail> exam(String examId) async => _detail();

  @override
  Future<void> saveExamResult({required String examId, required String studentId, required double marks, bool isAbsent = false}) async =>
      saved.add((studentId, marks, isAbsent));
}

Future<_FakePrincipal> _pumpPrincipal(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1}) async {
  await _setView(tester, width: width, textScale: textScale);
  final repo = _FakePrincipal();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repo,
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

// -------------------------------------------------------------------- teacher

class _FakeTeacher extends Fake implements TeacherRepository {
  final scheduled = <NewExam>[];
  var _exams = <ExamSummary>[];

  @override
  Future<List<TeachingClass>> marksContext() async => [
        for (final item in _contextJson()['classes'] as List) TeachingClass.fromJson((item as Map).cast<String, dynamic>()),
      ];

  @override
  Future<List<ExamSummary>> exams({String? classId}) async => _exams.where((exam) => exam.classId == classId).toList();

  @override
  Future<List<ExamClass>> examClasses() async => ExamClass.listFromContext(_contextJson());

  @override
  Future<ExamSummary> scheduleExam(NewExam exam) async {
    scheduled.add(exam);
    final created = ExamSummary.fromJson({..._examJson('t1', name: exam.name), 'classId': exam.classId});
    _exams = [created];
    return created;
  }

  @override
  Future<ExamDetail> exam(String examId) async => ExamDetail.fromJson({
        ..._examJson(examId, name: 'Class Test 3', pending: 1),
        'students': [
          {'studentId': 's1', 'fullName': 'Aarav', 'rollNumber': 1, 'result': null},
        ],
      });
}

void main() {
  group('Exam rules', () {
    test('a scheduled exam posts no results, and a teacher may only pick two terms', () {
      final body = NewExam(
        classId: 'c1',
        subjectId: 'sub1',
        name: ' Mid-Term 1 ',
        term: ExamTerm.midTerm,
        maxMarks: 80,
        passingMarks: 28,
        date: DateTime(2026, 10, 5),
        description: '  ',
      ).toJson();
      expect(body, {
        'classId': 'c1',
        'subjectId': 'sub1',
        'name': 'Mid-Term 1',
        'term': 'MID_TERM',
        'maxMarks': 80.0,
        'passingMarks': 28.0,
        'date': '2026-10-05',
        'results': <Object>[],
      });
      expect(ExamTerm.teacherTerms.map((term) => term.apiValue), ['UNIT_TEST', 'CLASS_TEST']);
      expect(ExamTerm.fromApi('FINAL'), ExamTerm.finalExam);
    });

    test('the stage follows the marks, not the server’s date-only status', () {
      final now = DateTime(2026, 9, 14, 11);
      expect(ExamSummary.fromJson(_examJson('a', date: '2026-09-20T00:00:00.000Z')).stageAt(now), ExamStage.scheduled);
      expect(ExamSummary.fromJson(_examJson('b', date: '2026-09-01T00:00:00.000Z')).stageAt(now), ExamStage.marksPending);
      expect(ExamSummary.fromJson(_examJson('c', entered: 2, pending: 1)).stageAt(now), ExamStage.marksPending);
      expect(ExamSummary.fromJson(_examJson('d', entered: 3, pending: 0)).stageAt(now), ExamStage.complete);
    });

    test('calendar drafts send plain dates and never a holiday type', () {
      final draft = CalendarEventDraft(
        type: CalendarEventType.exam,
        title: ' Unit Test Week ',
        startDate: DateTime(2026, 9, 28),
        endDate: DateTime(2026, 10, 2),
      );
      expect(draft.toJson(), {'type': 'EXAM', 'title': 'Unit Test Week', 'startDate': '2026-09-28', 'endDate': '2026-10-02'});
      expect(CalendarEventDraft.editableTypes, isNot(contains(CalendarEventType.holiday)));
    });
  });

  group('Schedule Exam form', () {
    testWidgets('requires a subject from the chosen class and submits the exam', (tester) async {
      await _setView(tester);
      final submitted = <NewExam>[];
      await tester.pumpWidget(MaterialApp(
        home: ScheduleExamScreen(
          loadClasses: () async => ExamClass.listFromContext(_contextJson()),
          terms: ExamTerm.teacherTerms,
          onSubmit: (exam) async {
            submitted.add(exam);
            return ExamSummary.fromJson(_examJson('x', name: exam.name));
          },
          initialClassId: 'c1',
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Schedule Exam'));
      await tester.pumpAndSettle();
      expect(find.text('Choose a subject'), findsOneWidget);
      expect(find.text('Exam name is required.'), findsOneWidget);
      expect(submitted, isEmpty);

      // Only the teacher's two terms are offered.
      await tester.tap(find.text('Unit Test'));
      await tester.pumpAndSettle();
      expect(find.text('Mid-Term'), findsNothing);
      await tester.tap(find.text('Class Test').last);
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Subject *'));
      await tester.pumpAndSettle();
      expect(find.text('English'), findsNothing, reason: 'another class’s subject');
      await tester.tap(find.text('Science').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Exam name *'), 'Class Test 3');
      await tester.enterText(find.widgetWithText(TextFormField, 'Passing marks'), '150');
      await tester.tap(find.widgetWithText(FilledButton, 'Schedule Exam'));
      await tester.pumpAndSettle();
      expect(find.text('Not above max'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextFormField, 'Passing marks'), '35');
      await tester.tap(find.widgetWithText(FilledButton, 'Schedule Exam'));
      await tester.pumpAndSettle();
      expect(submitted.single.subjectId, 'sub2');
      expect(submitted.single.term, ExamTerm.classTest);
      expect(submitted.single.maxMarks, 100);
      expect(submitted.single.passingMarks, 35);
    });
  });

  group('Teacher Marks', () {
    testWidgets('Create Test schedules a test and selects it for marks entry', (tester) async {
      await _setView(tester);
      final repo = _FakeTeacher();
      await tester.pumpWidget(
        Provider<TeacherRepository>.value(value: repo, child: const MaterialApp(home: MarksScreen())),
      );
      await tester.pumpAndSettle();
      expect(find.text('No exams for this class'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Create Test'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Subject *'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mathematics').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Exam name *'), 'Class Test 3');
      await tester.tap(find.widgetWithText(FilledButton, 'Schedule Exam'));
      await tester.pumpAndSettle();

      expect(repo.scheduled.single.classId, 'c1');
      expect(repo.scheduled.single.term, ExamTerm.unitTest);
      expect(find.text('No exams for this class'), findsNothing);
      expect(find.text('Class Test 3 • Mathematics'), findsOneWidget);
      expect(find.text('Not entered'), findsOneWidget);
    });
  });

  group('Academic Calendar (principal)', () {
    testWidgets('adds an event from the selected day', (tester) async {
      final repo = await _pumpPrincipal(tester, const AcademicCalendarScreen());
      final now = DateTime.now();
      final day = DateTime(now.year, now.month, 15);
      await tester.tap(find.byKey(ValueKey('calendar-day-${day.year}-${day.month.toString().padLeft(2, '0')}-15')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Add New Event'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Exam'));
      await tester.enterText(find.widgetWithText(TextFormField, 'Title *'), 'Unit Test Week');
      await tester.tap(find.text('Add Event'));
      await tester.pumpAndSettle();

      final draft = repo.created.single;
      expect(draft.type, CalendarEventType.exam);
      expect(draft.startDate, day);
      expect(draft.endDate, day);
      expect(find.text('Academic Calendar'), findsOneWidget, reason: 'back on the calendar');
    });

    testWidgets('a holiday is not editable; an event opens for edit and delete', (tester) async {
      final repo = await _pumpPrincipal(tester, const AcademicCalendarScreen());

      await tester.tap(find.text('Founders Day'));
      await tester.pumpAndSettle();
      expect(find.text('Holidays are managed in Attendance on the web dashboard.'), findsOneWidget);
      expect(find.text('Edit Event'), findsNothing);

      await tester.tap(find.text('Parent Teacher Meeting'));
      await tester.pumpAndSettle();
      expect(find.text('Edit Event'), findsOneWidget);
      await tester.tap(find.byTooltip('Delete event'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(repo.deleted, ['ev1']);
    });

    testWidgets('an end date before the start is refused before any call', (tester) async {
      await _setView(tester);
      final repo = _FakePrincipal();
      await tester.pumpWidget(
        Provider<PrincipalRepository>.value(
          value: repo,
          child: MaterialApp(
            home: EventFormScreen(
              event: CalendarEvent(
                id: 'ev1',
                type: CalendarEventType.event,
                title: 'Sports Day',
                startDate: DateTime(2026, 9, 20),
                endDate: DateTime(2026, 9, 21),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Title *'), 'Sp');
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();
      expect(find.text('Give the event a title'), findsOneWidget);
      expect(repo.updated, isEmpty);

      await tester.enterText(find.widgetWithText(TextFormField, 'Title *'), 'Annual Sports Day');
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();
      expect(repo.updated.single.$1, 'ev1');
      expect(repo.updated.single.$2.endDate, DateTime(2026, 9, 21));
    });
  });

  group('Exams (principal)', () {
    testWidgets('counts each stage and filters to it', (tester) async {
      // Wide enough that every stage tab is on screen without scrolling.
      await _pumpPrincipal(tester, const ExamsScreen(), width: 800);
      expect(find.byType(ExamSummaryCard), findsNWidgets(3));

      await tester.tap(find.text('Scheduled').first);
      await tester.pumpAndSettle();
      expect(find.byType(ExamSummaryCard), findsOneWidget);
      expect(find.text('Half Yearly'), findsOneWidget);

      await tester.tap(find.text('Marks entered').first);
      await tester.pumpAndSettle();
      expect(find.text('Unit Test 1'), findsOneWidget);
      expect(find.text('Unit Test 2'), findsNothing);
    });

    testWidgets('the principal can amend marks a teacher could not', (tester) async {
      final repo = await _pumpPrincipal(tester, const ExamResultsScreen(examId: 'e1'));
      expect(find.text('45/50 · A+'), findsOneWidget);

      await tester.tap(find.text('Aarav').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '48');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(repo.saved, [('s1', 48.0, false)]);
    });

    testWidgets('lays out at 320dp with 1.3x text', (tester) async {
      await _pumpPrincipal(tester, const ExamsScreen(), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
      await _pumpPrincipal(tester, const ExamResultsScreen(examId: 'e1'), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
      await _pumpPrincipal(tester, const EventFormScreen(), width: 320, textScale: 1.3);
      expect(tester.takeException(), isNull);
    });
  });
}
