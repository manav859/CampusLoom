import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/teacher/data/academics_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/students/my_students_screen.dart';

/// One class of three, with today's register already marked, so the tiles and
/// every sort order have something to disagree about.
class _FakeRepository extends Fake implements TeacherRepository {
  _FakeRepository({this.marked = true});

  /// False stands for a register nobody has submitted yet.
  final bool marked;

  @override
  Future<List<ClassOption>> myClasses({bool classTeacherOnly = false}) async =>
      [const ClassOption(id: 'c1', name: '1', section: 'A')];

  /// Roll, name and attendance deliberately disagree, so each sort order is
  /// a different list and a test cannot pass by coincidence. Served out of
  /// order too, so the screen has to sort rather than echo the server.
  ///   roll:       Meera(1), Zara(2), Aditya(3)
  ///   name:       Aditya, Meera, Zara
  ///   attendance: Zara(62), Meera(88), Aditya(95)
  @override
  Future<List<StudentListItem>> students({String? classId, String? search}) async => [
        StudentListItem.fromJson({
          'id': 's3',
          'fullName': 'Zara Shaikh',
          'admissionNumber': 'ADM-3',
          'rollNumber': 2,
          'attendancePercentage': 62,
        }),
        StudentListItem.fromJson({
          'id': 's1',
          'fullName': 'Aditya Parikh',
          'admissionNumber': 'ADM-1',
          'rollNumber': 3,
          'attendancePercentage': 95,
        }),
        StudentListItem.fromJson({
          'id': 's2',
          'fullName': 'Meera Joshi',
          'admissionNumber': 'ADM-2',
          'rollNumber': 1,
          'attendancePercentage': 88,
        }),
      ];

  @override
  Future<TeacherDashboard> dashboard() async => TeacherDashboard.fromJson({
        'attendance': [
          {
            'classId': 'c1',
            'className': '1-A',
            'marked': marked,
            'totalStudents': 3,
            'present': 1,
            'absent': 1,
            'leave': 1,
            'attendancePercentage': 33,
          },
        ],
      });
}

Future<void> _pump(WidgetTester tester, {bool marked = true}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    Provider<TeacherRepository>.value(
      value: _FakeRepository(marked: marked),
      child: const MaterialApp(home: MyStudentsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

/// The names in the order the cards are laid out.
List<String> _order(WidgetTester tester) {
  const names = ['Aditya Parikh', 'Meera Joshi', 'Zara Shaikh'];
  final placed = [
    for (final name in names) (name: name, top: tester.getTopLeft(find.text(name)).dy),
  ]..sort((a, b) => a.top.compareTo(b.top));
  return [for (final entry in placed) entry.name];
}

Future<void> _sortBy(WidgetTester tester, String label) async {
  await tester.tap(find.byTooltip('Sort'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('today\'s register fills the tiles, leave included', (tester) async {
    await _pump(tester);

    expect(find.text('Total Students'), findsOneWidget);
    expect(find.text('3'), findsOneWidget, reason: 'three on the roll');
    expect(find.text('On Leave'), findsOneWidget);
    // present 1, absent 1, leave 1 — three tiles reading "1".
    expect(find.text('1'), findsNWidgets(3));
  });

  testWidgets('an unmarked register shows dashes, not zeroes', (tester) async {
    await _pump(tester, marked: false);

    expect(find.text('—'), findsNWidgets(3), reason: 'present, absent and leave are unknown');
    expect(find.text('3'), findsOneWidget, reason: 'the roll is known either way');
  });

  testWidgets('the roll opens in roll-number order, not the order served', (tester) async {
    await _pump(tester);

    expect(_order(tester), ['Meera Joshi', 'Zara Shaikh', 'Aditya Parikh']);
  });

  testWidgets('sorting by attendance puts the lowest first', (tester) async {
    await _pump(tester);
    await _sortBy(tester, 'Attendance (lowest first)');

    expect(_order(tester), ['Zara Shaikh', 'Meera Joshi', 'Aditya Parikh']);
  });

  testWidgets('sorting by name is alphabetical, not by roll', (tester) async {
    await _pump(tester);
    await _sortBy(tester, 'Name (A–Z)');

    expect(_order(tester), ['Aditya Parikh', 'Meera Joshi', 'Zara Shaikh']);
  });

  testWidgets('a search narrows the roll', (tester) async {
    await _pump(tester);

    await tester.enterText(find.byType(TextField), 'meera');
    await tester.pumpAndSettle();

    expect(find.text('Meera Joshi'), findsOneWidget);
    expect(find.text('Zara Shaikh'), findsNothing);
  });

  test('initials stand in for a photo', () {
    expect(initialsOf('Aditya Parikh'), 'AP');
    expect(initialsOf('Meera Sai Joshi'), 'MJ', reason: 'first and last, never the middle');
    expect(initialsOf('Prince'), 'P');
    expect(initialsOf('  '), '?');
  });
}
