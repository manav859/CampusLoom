import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/data/parent_session.dart';
import 'package:smartshala_mobile/features/parent/parent_shell.dart';

/// Serves a fixed set of children and a stub Home aggregate for whichever child
/// the Home tab asks about. The Home screen also reads fees, the calendar and
/// announcements; those are stubbed benignly so the screen renders.
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
        parentName: 'Sunita Sharma',
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

  @override
  Future<ChildFees> fees(String childId) async => const ChildFees(
        total: 0,
        paid: 0,
        balance: 0,
        status: 'PAID',
        assignments: [],
        payments: [],
      );

  @override
  Future<List<CalendarEvent>> calendar(DateTime month) async => const [];

  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async =>
      AnnouncementPage.empty;
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

    // The dashboard for the chosen child: picker gone, child on the student
    // card, and the Home tab loaded.
    expect(session.selected?.id, 'a');
    expect(find.text('Select student'), findsNothing);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text("Here's everything about your child's school life."), findsOneWidget);

    // Tapping the student card is the way back to the picker when there is more
    // than one child.
    await tester.tap(find.text('Aarav Sharma'));
    await tester.pumpAndSettle();
    expect(find.text('Select student'), findsOneWidget);
  });

  testWidgets('one child: the picker is skipped and the dashboard opens directly', (tester) async {
    final repo = _FakeParentRepository([_child('solo', 'Riya Patel', className: 'Class 3 - A')]);
    final session = ParentSession(repo);

    await tester.pumpWidget(_wrap(repo, session));
    await tester.pumpAndSettle();

    expect(find.text('Select student'), findsNothing);
    expect(session.selected?.id, 'solo');
    expect(find.text('Riya Patel'), findsOneWidget);
    expect(find.text("Here's everything about your child's school life."), findsOneWidget);
    expect(repo.calls, 1);
  });
}
