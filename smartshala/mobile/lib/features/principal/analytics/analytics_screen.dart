import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/analytics_models.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import '../reports/class_performance_report_screen.dart';
import '../reports/report_widgets.dart';
import '../reports/student_report_screen.dart';

class _Analytics {
  const _Analytics({required this.risk, required this.classes});

  final RiskSummary risk;
  final List<ClassPerformanceRow> classes;
}

/// Analytics: the school's risk picture with week-on-week movement and the
/// severity split — the parts of the web Analytics page the Reports screens do
/// not show. The flagged-student list and the full class table stay in Reports,
/// linked from the bottom rather than duplicated here.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  late Future<_Analytics> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Analytics> _load() async {
    final repository = context.read<PrincipalRepository>();
    final results = await Future.wait<Object>([repository.riskSummary(), repository.classPerformance()]);
    return _Analytics(
      risk: results[0] as RiskSummary,
      classes: results[1] as List<ClassPerformanceRow>,
    );
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() => _future = future);
    await future.then((_) {}, onError: (Object _) {});
  }

  void _open(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: FutureBuilder<_Analytics>(
        future: _future,
        builder: (context, snapshot) => switch (snapshot) {
          AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
          AsyncSnapshot(hasError: true, :final error) => ErrorView(
              message: error is ApiException ? error.message : 'Unable to load analytics.',
              onRetry: _reload,
            ),
          AsyncSnapshot(:final data?) => RefreshIndicator(
              onRefresh: _reload,
              child: _body(data),
            ),
          _ => const LoadingView(),
        },
      ),
    );
  }

  Widget _body(_Analytics data) {
    final risk = data.risk;
    final attention = data.classes.where((row) => row.status != 'Healthy').toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (risk.principalSummary.isNotEmpty)
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.insights_rounded, size: 20, color: AppColors.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    risk.principalSummary,
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.35),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 16),
        const SectionHeader(title: 'Students At Risk'),
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 4,
          spacing: 8,
          children: [
            _Kpi(
              value: '${risk.lowAttendanceCount}',
              label: 'Below 75%',
              icon: Icons.trending_down_rounded,
              trend: risk.lowAttendanceTrend,
            ),
            _Kpi(
              value: '${risk.totalFlagged}',
              label: 'Flagged',
              icon: Icons.flag_rounded,
              trend: risk.totalRiskTrend,
            ),
            _Kpi(
              value: '${risk.combinedRiskCount}',
              label: 'Attendance + fees',
              icon: Icons.priority_high_rounded,
            ),
            _Kpi(
              value: '${risk.repeatAbsenteeCount}',
              label: 'Repeat absentees',
              icon: Icons.event_busy_rounded,
            ),
          ],
        ),
        const SizedBox(height: 16),
        const SectionHeader(title: 'By Severity'),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Expanded(child: _Severity(count: risk.high, label: 'High', color: AppColors.danger, tint: AppColors.dangerSoft)),
              Expanded(child: _Severity(count: risk.medium, label: 'Medium', color: AppColors.warning, tint: AppColors.warningSoft)),
              Expanded(child: _Severity(count: risk.low, label: 'Low', color: AppColors.primary, tint: AppColors.primarySoft)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const SectionHeader(title: 'Classes Needing Attention'),
        if (attention.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(
              icon: Icons.task_alt_rounded,
              title: 'Every class is healthy',
              message: 'No class is below the attendance watch threshold this month.',
            ),
          )
        else
          for (final row in attention) ...[
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(row.className, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          '${row.studentCount} students · ${row.markedDays} days marked',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  percentChip(row.attendancePercentage),
                  const SizedBox(width: 8),
                  StatusChip(
                    label: row.status,
                    color: row.status == 'Watch' ? AppColors.warning : AppColors.danger,
                    tint: row.status == 'Watch' ? AppColors.warningSoft : AppColors.dangerSoft,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _open(const StudentReportScreen()),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
          icon: const Icon(Icons.groups_rounded, size: 18),
          label: const Text('See flagged students'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => _open(const ClassPerformanceReportScreen()),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
          icon: const Icon(Icons.class_rounded, size: 18),
          label: const Text('All class performance'),
        ),
      ],
    );
  }
}

/// A count with the week-on-week movement under it. For risk counts a rise is
/// the bad direction, so `up` reads red and `down` green.
class _Kpi extends StatelessWidget {
  const _Kpi({required this.value, required this.label, required this.icon, this.trend});

  final String value;
  final String label;
  final IconData icon;
  final RiskTrend? trend;

  @override
  Widget build(BuildContext context) {
    final movement = trend;
    final (Color color, IconData arrow) = switch (movement?.direction) {
      'up' => (AppColors.danger, Icons.arrow_upward_rounded),
      'down' => (AppColors.success, Icons.arrow_downward_rounded),
      _ => (AppColors.textMuted, Icons.remove_rounded),
    };

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  value,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.1),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
          if (movement != null) ...[
            const SizedBox(height: 5),
            Row(
              children: [
                Icon(arrow, size: 13, color: color),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    movement.label,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Severity extends StatelessWidget {
  const _Severity({required this.count, required this.label, required this.color, required this.tint});

  final int count;
  final String label;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
          child: Text(
            '$count',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color),
          ),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
