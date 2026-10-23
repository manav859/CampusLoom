import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_academics_screen.dart';
import 'package:smartshala_mobile/features/parent/parent_homework_screen.dart';

class _FakeParentRepository extends Fake implements ParentRepository {
  @override
  Future<ChildAcademics> academics(String childId) async => const ChildAcademics(
        overallPercentage: 78,
        overallGrade: 'B+',
        exams: [
          ExamResultGroup(
            id: 'e1',
            name: 'Mid Term',
            term: 'MID_TERM',
            date: null,
            percentage: 80,
            grade: 'A',
            subjects: [
              ExamSubject(subject: 'English', marks: '85/100', percentage: 85, grade: 'A', isAbsent: false),
              ExamSubject(subject: 'Maths', marks: '75/100', percentage: 75, grade: 'B+', isAbsent: false),
            ],
          ),
        ],
      );

  @override
  Future<List<HomeworkItem>> homework(String childId) async => [
        HomeworkItem(id: 'h1', title: 'Fractions Exercise 4', subject: 'Maths', completed: false, dueDate: DateTime(2026, 10, 12)),
        HomeworkItem(id: 'h2', title: 'Read Chapter 3', subject: 'Science', completed: true, dueDate: DateTime(2026, 10, 5)),
      ];
}

Widget _wrap(Widget child) => Provider<ParentRepository>.value(
      value: _FakeParentRepository(),
      child: MaterialApp(home: child),
    );

void main() {
  testWidgets('academics shows overall performance and an exam breakdown', (tester) async {
    await tester.pumpWidget(_wrap(const ParentAcademicsScreen(childId: 'a', childName: 'Aarav')));
    await tester.pumpAndSettle();

    expect(find.text('Overall performance'), findsOneWidget);
    expect(find.text('78%'), findsOneWidget); // the ring figure
    expect(find.text('Mid Term'), findsWidgets);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('85/100'), findsOneWidget);
  });

  testWidgets('homework toggles between pending and completed', (tester) async {
    await tester.pumpWidget(_wrap(const ParentHomeworkScreen(childId: 'a', childName: 'Aarav')));
    await tester.pumpAndSettle();

    // Pending tab is default: the pending item shows, the completed one does not.
    expect(find.text('Pending (1)'), findsOneWidget);
    expect(find.text('Completed (1)'), findsOneWidget);
    expect(find.text('Fractions Exercise 4'), findsOneWidget);
    expect(find.text('Read Chapter 3'), findsNothing);

    await tester.tap(find.text('Completed (1)'));
    await tester.pumpAndSettle();

    expect(find.text('Read Chapter 3'), findsOneWidget);
    expect(find.text('Fractions Exercise 4'), findsNothing);
  });
}
