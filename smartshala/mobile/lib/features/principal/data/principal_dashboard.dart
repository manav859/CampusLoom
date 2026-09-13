import '../../../core/data/dashboard_models.dart';

/// GET /dashboard for a Principal or Admin, with the numbers the web admin
/// dashboard derives from it (DashboardHome.tsx, mode "ADMIN").
class PrincipalDashboard {
  const PrincipalDashboard({
    required this.totalStudents,
    required this.totalClasses,
    required this.classesMarked,
    required this.alertCount,
    required this.totalCollected,
    required this.totalPending,
    required this.defaulterCount,
    required this.attendance,
    required this.alerts,
    required this.defaulters,
  });

  final int totalStudents;
  final int totalClasses;
  final int classesMarked;

  /// Low attendance + repeat absentees + high-severity risks, counted server-side.
  final int alertCount;
  final double totalCollected;
  final double totalPending;
  final int defaulterCount;
  final List<ClassAttendance> attendance;
  final List<DashboardAlert> alerts;
  final List<FeeDefaulter> defaulters;

  static const empty = PrincipalDashboard(
    totalStudents: 0,
    totalClasses: 0,
    classesMarked: 0,
    alertCount: 0,
    totalCollected: 0,
    totalPending: 0,
    defaulterCount: 0,
    attendance: [],
    alerts: [],
    defaulters: [],
  );

  /// "Marked Today": classes marked / all classes, rounded, 0 with no classes.
  int get markedTodayPercentage =>
      totalClasses == 0 ? 0 : (classesMarked / totalClasses * 100).round();

  /// The web's pulse line, word for word.
  String get pulse =>
      '$classesMarked of $totalClasses classes marked today, $defaulterCount fee follow-ups pending.';

  List<ActionAlert> get actionAlerts => buildActionAlerts(
    defaulters: defaulters,
    alerts: alerts,
    attendance: attendance,
  );

  factory PrincipalDashboard.fromJson(Map<String, dynamic> json) {
    final kpis = (json['kpis'] as Map?)?.cast<String, dynamic>() ?? const {};
    final fees = (json['feeSummary'] as Map?)?.cast<String, dynamic>();
    int kpi(String key) => (kpis[key] as num?)?.toInt() ?? 0;
    double money(Object? value) =>
        value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

    final alerts = DashboardAlert.listFrom(json['alerts']);
    final defaulters = FeeDefaulter.listFrom(json['defaulters']);

    return PrincipalDashboard(
      totalStudents: kpi('totalStudents'),
      totalClasses: kpi('totalClasses'),
      classesMarked: kpi('classesMarked'),
      // Same fallbacks, in the same order, as the web.
      alertCount: (kpis['alerts'] as num?)?.toInt() ?? alerts.length,
      defaulterCount:
          (fees?['defaulterCount'] as num?)?.toInt() ?? defaulters.length,
      totalCollected: money(fees?['totalCollected']),
      totalPending: money(fees?['totalPending']),
      attendance: ClassAttendance.listFrom(json['attendance']),
      alerts: alerts,
      defaulters: defaulters,
    );
  }
}
