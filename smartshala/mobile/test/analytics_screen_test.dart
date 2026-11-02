import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/features/principal/analytics/analytics_screen.dart';
import 'package:smartshala_mobile/features/principal/data/analytics_models.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/report_models.dart';

Map<String, dynamic> _summary() => {
      'lowAttendanceCount': 7,
      'combinedRiskCount': 2,
      'repeatAbsenteeCount': 3,
      'severityCounts': {'HIGH': 4, 'MEDIUM': 5, 'LOW': 6},
      'trends': {
        'lowAttendance': {'current': 7, 'previous': 4, 'delta': 3, 'direction': 'up'},
        'totalRisk': {'current': 15, 'previous': 18, 'delta': -3, 'direction': 'down'},
      },
      'principalSummary': '2 students need priority follow-up.',
      'studentRisks': [],
    };

class _FakeRepository extends Fake implements PrincipalRepository {
  @override
  Future<RiskSummary> riskSummary() async => RiskSummary.fromJson(_summary());

  @override
  Future<List<ClassPerformanceRow>> classPerformance() async => [
        ClassPerformanceRow.fromJson({
          'classId': 'c1',
          'className': '6-A',
          'studentCount': 30,
          'markedDays': 10,
          'attendancePercentage': 88,
          'status': 'Healthy',
        }),
        ClassPerformanceRow.fromJson({
          'classId': 'c2',
          'className': '7-B',
          'studentCount': 28,
          'markedDays': 9,
          'attendancePercentage': 71,
          'status': 'Needs attention',
        }),
      ];
}

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1200, 4000);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: _FakeRepository(),
      child: const MaterialApp(home: AnalyticsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('risk summary reads the counts, severity split and trends', () {
    final risk = RiskSummary.fromJson(_summary());

    expect(risk.lowAttendanceCount, 7);
    expect(risk.combinedRiskCount, 2);
    expect(risk.repeatAbsenteeCount, 3);
    expect(risk.high, 4);
    expect(risk.medium, 5);
    expect(risk.low, 6);
    // totalRisk.current is every flagged student, not just the 25 the server lists.
    expect(risk.totalFlagged, 15);
    expect(risk.lowAttendanceTrend.direction, 'up');
    expect(risk.lowAttendanceTrend.label, '+3 vs last week');
    expect(risk.totalRiskTrend.label, '-3 vs last week');
  });

  test('a missing trend block falls back to flat rather than throwing', () {
    final risk = RiskSummary.fromJson({'lowAttendanceCount': 1});

    expect(risk.lowAttendanceTrend.direction, 'flat');
    expect(risk.lowAttendanceTrend.label, 'No change');
    expect(risk.totalFlagged, 0);
  });

  testWidgets('shows the summary, risk counts, severity and only unhealthy classes', (tester) async {
    await _pump(tester);

    expect(find.text('2 students need priority follow-up.'), findsOneWidget);
    expect(find.text('Below 75%'), findsOneWidget);
    expect(find.text('Flagged'), findsOneWidget);
    expect(find.text('High'), findsOneWidget);
    expect(find.text('Medium'), findsOneWidget);

    // Week-on-week movement is the thing the Reports screens do not show.
    expect(find.text('+3 vs last week'), findsOneWidget);
    expect(find.text('-3 vs last week'), findsOneWidget);

    // Only the class needing attention is listed; the healthy one is not.
    expect(find.text('7-B'), findsOneWidget);
    expect(find.text('6-A'), findsNothing);
  });
}
