import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_attendance_screen.dart';

class _FakeParentRepository extends Fake implements ParentRepository {
  String? askedMonth;

  @override
  Future<MonthlyAttendance> attendance(String childId, {String? month}) async {
    askedMonth = month;
    final now = DateTime.now();
    return MonthlyAttendance(
      summary: const AttendanceSummary(
        month: '2026-10',
        percentage: 92,
        present: 18,
        absent: 1,
        leave: 0,
        totalDays: 19,
      ),
      daily: [
        AttendanceDay(date: DateTime(now.year, now.month, 1), status: AttendanceStatus.present),
        AttendanceDay(date: DateTime(now.year, now.month, 2), status: AttendanceStatus.absent),
      ],
    );
  }
}

void main() {
  testWidgets('attendance screen shows the percentage, counts and a legend', (tester) async {
    final repo = _FakeParentRepository();

    await tester.pumpWidget(
      Provider<ParentRepository>.value(
        value: repo,
        child: const MaterialApp(
          home: ParentAttendanceScreen(childId: 'a', childName: 'Aarav Sharma'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Loaded the current month by default.
    expect(repo.askedMonth, isNotNull);
    // The ring figure and the stat tiles.
    expect(find.text('92%'), findsOneWidget);
    expect(find.text('Present'), findsWidgets);
    expect(find.text('Absent'), findsWidgets);
    expect(find.text('Total Days'), findsOneWidget);
    // Present count (also appears as a calendar day cell, hence findsWidgets).
    expect(find.text('18'), findsWidgets);
    // The calendar weekday header renders.
    expect(find.text('Mon'), findsOneWidget);
    expect(find.text('Sun'), findsOneWidget);
  });
}
