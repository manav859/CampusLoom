int _int(Object? value) => value is num ? value.round() : int.tryParse('${value ?? ''}') ?? 0;

/// A count against the previous week, as GET /analytics/risk-summary reports it.
class RiskTrend {
  const RiskTrend({
    required this.current,
    required this.previous,
    required this.delta,
    required this.direction,
  });

  final int current;
  final int previous;
  final int delta;

  /// `up`, `down` or `flat`. For risk counts, `up` is the bad direction.
  final String direction;

  static const flat = RiskTrend(current: 0, previous: 0, delta: 0, direction: 'flat');

  /// "+3 vs last week", or "No change" when flat.
  String get label => switch (direction) {
        'up' => '+$delta vs last week',
        'down' => '$delta vs last week',
        _ => 'No change',
      };

  factory RiskTrend.fromJson(Map<String, dynamic> json) => RiskTrend(
        current: _int(json['current']),
        previous: _int(json['previous']),
        delta: _int(json['delta']),
        direction: json['direction'] as String? ?? 'flat',
      );
}

/// The school's risk picture from GET /analytics/risk-summary — the counts,
/// severity split and week-on-week trends the web Analytics page shows. The
/// per-student list is read separately via `studentRisks()`, which strips fee
/// signals; these counts are the server's own, fees included.
class RiskSummary {
  const RiskSummary({
    required this.lowAttendanceCount,
    required this.combinedRiskCount,
    required this.repeatAbsenteeCount,
    required this.high,
    required this.medium,
    required this.low,
    required this.lowAttendanceTrend,
    required this.totalRiskTrend,
    required this.principalSummary,
  });

  final int lowAttendanceCount;
  final int combinedRiskCount;
  final int repeatAbsenteeCount;
  final int high;
  final int medium;
  final int low;
  final RiskTrend lowAttendanceTrend;
  final RiskTrend totalRiskTrend;

  /// The server's one-line read of the month, shown at the top of the screen.
  final String principalSummary;

  /// Every flagged student, whatever the severity.
  int get totalFlagged => totalRiskTrend.current;

  factory RiskSummary.fromJson(Map<String, dynamic> json) {
    final severity = (json['severityCounts'] as Map?)?.cast<String, dynamic>() ?? const {};
    final trends = (json['trends'] as Map?)?.cast<String, dynamic>() ?? const {};

    RiskTrend trend(String key) {
      final raw = (trends[key] as Map?)?.cast<String, dynamic>();
      return raw == null ? RiskTrend.flat : RiskTrend.fromJson(raw);
    }

    return RiskSummary(
      lowAttendanceCount: _int(json['lowAttendanceCount']),
      combinedRiskCount: _int(json['combinedRiskCount']),
      repeatAbsenteeCount: _int(json['repeatAbsenteeCount']),
      high: _int(severity['HIGH']),
      medium: _int(severity['MEDIUM']),
      low: _int(severity['LOW']),
      lowAttendanceTrend: trend('lowAttendance'),
      totalRiskTrend: trend('totalRisk'),
      principalSummary: json['principalSummary'] as String? ?? '',
    );
  }
}
