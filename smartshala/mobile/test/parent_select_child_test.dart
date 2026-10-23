import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/data/parent_session.dart';
import 'package:smartshala_mobile/features/parent/parent_shell.dart';

/// Serves a fixed set of children and counts how many times it was asked.
class _FakeParentRepository extends Fake implements ParentRepository {
  _FakeParentRepository(this.result);

  final List<ParentChild> result;
  int calls = 0;

  @override
  Future<List<ParentChild>> children() async {
    calls++;
    return result;
  }
}

ParentChild _child(String id, String name, {String? className, int? roll}) =>
    ParentChild(id: id, fullName: name, className: className, rollNumber: roll);

Widget _wrap(ParentSession session) => ChangeNotifierProvider<ParentSession>.value(
      value: session,
      child: MaterialApp(home: const ParentShell()),
    );

void main() {
  testWidgets('two children: the picker lists both, and choosing one opens the dashboard', (tester) async {
    final repo = _FakeParentRepository([
      _child('a', 'Aarav Sharma', className: 'Class 5 - A', roll: 12),
      _child('b', 'Diya Sharma', className: 'Class 2 - B', roll: 7),
    ]);
    final session = ParentSession(repo);

    await tester.pumpWidget(_wrap(session));
    await tester.pumpAndSettle();

    // The picker is shown with both children; no child is auto-selected.
    expect(find.text('Select student'), findsOneWidget);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text('Diya Sharma'), findsOneWidget);
    expect(session.selected, isNull);

    await tester.tap(find.text('Aarav Sharma'));
    await tester.pumpAndSettle();

    // The dashboard for the chosen child: picker gone, child in the header,
    // the Home tab's placeholder visible, and a way to switch children.
    expect(session.selected?.id, 'a');
    expect(find.text('Select student'), findsNothing);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text('Home coming soon'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
  });

  testWidgets('one child: the picker is skipped and the dashboard opens directly', (tester) async {
    final repo = _FakeParentRepository([_child('solo', 'Riya Patel', className: 'Class 3 - A')]);
    final session = ParentSession(repo);

    await tester.pumpWidget(_wrap(session));
    await tester.pumpAndSettle();

    expect(find.text('Select student'), findsNothing);
    expect(session.selected?.id, 'solo');
    expect(find.text('Riya Patel'), findsOneWidget);
    expect(find.text('Home coming soon'), findsOneWidget);
    // A single child has nothing to switch to.
    expect(find.text('Change'), findsNothing);
    expect(repo.calls, 1);
  });
}
