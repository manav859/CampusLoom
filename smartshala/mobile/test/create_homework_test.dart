import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/teacher/data/academics_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/homework/create_homework_screen.dart';

/// Homework that fell due yesterday cannot be done, but the date picker opened
/// on yesterday all the same (reported on the 2026-09-24 device run).
class _FakeRepository extends Fake implements TeacherRepository {
  @override
  Future<List<TeachingClass>> homeworkContext() async => const [
        TeachingClass(
          id: 'c1',
          name: '8',
          section: 'A',
          subjects: [SubjectOption(id: 's1', name: 'Science')],
        ),
      ];
}

Future<void> _openDueDatePicker(WidgetTester tester) async {
  await tester.pumpWidget(
    Provider<TeacherRepository>.value(
      value: _FakeRepository(),
      child: const MaterialApp(home: CreateHomeworkScreen()),
    ),
  );
  await tester.pumpAndSettle();

  await tester.tap(find.byIcon(Icons.calendar_today_rounded));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the due date calendar starts today, not yesterday', (tester) async {
    await _openDueDatePicker(tester);

    final dialog = tester.widget<DatePickerDialog>(find.byType(DatePickerDialog));
    final today = DateUtils.dateOnly(DateTime.now());

    expect(dialog.firstDate, today);
    expect(dialog.firstDate.isAfter(today.subtract(const Duration(days: 1))), isTrue);
  });

  testWidgets('a year of future due dates stays available', (tester) async {
    await _openDueDatePicker(tester);

    final dialog = tester.widget<DatePickerDialog>(find.byType(DatePickerDialog));

    expect(dialog.lastDate.difference(DateUtils.dateOnly(DateTime.now())).inDays, greaterThan(360));
    // Tomorrow is still what the form opens on.
    expect(dialog.initialDate, DateUtils.dateOnly(DateTime.now().add(const Duration(days: 1))));
  });
}
