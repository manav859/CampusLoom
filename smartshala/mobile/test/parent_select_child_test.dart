import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/data/parent_session.dart';
import 'package:smartshala_mobile/features/parent/parent_shell.dart';

/// Serves a fixed set of children and a stub Home aggregate for whichever child
/// the Home tab asks about.
class _FakeParentRepository extends Fake implements ParentRepository {
  _FakeParentRepository(this.result);

  final List<ParentChild> result;
  int calls = 0;

  @override
  Future<List<ParentChild>> children() async {
    calls++;
    return result;
  }

  @override
  Future<ChildHome> home(String childId) async => ChildHome(
        child: result.firstWhere((c) => c.id == childId),
        attendance: const AttendanceSummary(
          month: '2026-10',
          percentage: 92,
          present: 18,
          absent: 1,
          leave: 0,
          totalDays: 19,
        ),
        todayStatus: AttendanceStatus.present,
      );
}

ParentChild _child(String id, String name, {String? className, int? roll}) =>
    ParentChild(id: id, fullName: name, className: className, rollNumber: roll);

Widget _wrap(_FakeParentRepository repo, ParentSession session) => MultiProvider(
      providers: [
        Provider<ParentRepository>.value(value: repo),
        ChangeNotifierProvider<ParentSession>.value(value: session),
      ],
      child: const MaterialApp(home: ParentShell()),
    );

void main() {
  testWidgets('two children: the picker lists both, and choosing one opens the dashboard', (tester) async {
    final repo = _FakeParentRepository([
      _child('a', 'Aarav Sharma', className: 'Class 5 - A', roll: 12),
      _child('b', 'Diya Sharma', className: 'Class 2 - B', roll: 7),
    ]);
    final session = ParentSession(repo);

    await tester.pumpWidget(_wrap(repo, session));
    await tester.pumpAndSettle();

    // The picker is shown with both children; no child is auto-selected.
    expect(find.text('Select student'), findsOneWidget);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text('Diya Sharma'), findsOneWidget);
    expect(session.selected, isNull);

    await tester.tap(find.text('Aarav Sharma'));
    await tester.pumpAndSettle();

    // The dashboard for the chosen child: picker gone, child in the header,
    // the Home tab loaded, and a way to switch children.
    expect(session.selected?.id, 'a');
    expect(find.text('Select student'), findsNothing);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text("Today's attendance"), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
  });

  testWidgets('one child: the picker is skipped and the dashboard opens directly', (tester) async {
    final repo = _FakeParentRepository([_child('solo', 'Riya Patel', className: 'Class 3 - A')]);
    final session = ParentSession(repo);

    await tester.pumpWidget(_wrap(repo, session));
    await tester.pumpAndSettle();

    expect(find.text('Select student'), findsNothing);
    expect(session.selected?.id, 'solo');
    expect(find.text('Riya Patel'), findsOneWidget);
    expect(find.text("Today's attendance"), findsOneWidget);
    // A single child has nothing to switch to.
    expect(find.text('Change'), findsNothing);
    expect(repo.calls, 1);
  });
}
