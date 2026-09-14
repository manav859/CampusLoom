import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import '../students/student_profile_screen.dart';
import 'report_widgets.dart';

/// Student Report: students whose attendance this month needs attention, from
/// the risk summary the web Analytics page reads — with fees taken out, since
/// Reports carry no finance.
class StudentReportScreen extends StatefulWidget {
  const StudentReportScreen({super.key});

  @override
  State<StudentReportScreen> createState() => _StudentReportScreenState();
}

class _StudentReportScreenState extends State<StudentReportScreen> {
  late Future<List<StudentRisk>> _future;
  RiskLevel? _level;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().studentRisks();
  }

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().studentRisks();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _export(List<StudentRisk> rows) => shareReportCsv(
        name: 'students-needing-attention',
        subject: 'Students needing attention',
        csv: toCsv([
          ['Student', 'Class', 'Attendance this month', 'Absences this month', 'Flags', 'Level'],
          for (final row in rows)
            [
              row.studentName,
              row.className,
              '${row.attendancePercentage}%',
              row.absentThisMonth,
              row.flags.map(humanizeConstant).join('; '),
              row.level.name.toUpperCase(),
            ],
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<StudentRisk>>(
      future: _future,
      builder: (context, snapshot) {
        final all = snapshot.data;
        final visible = all == null ? null : [for (final row in all) if (_level == null || row.level == _level) row];

        return Scaffold(
          appBar: AppBar(
            title: const Text('Student Report'),
            actions: [ExportCsvAction(onPressed: visible == null || visible.isEmpty ? null : () => _export(visible))],
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load the student report.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    ResponsiveGrid(
                      phoneColumns: 3,
                      wideColumns: 3,
                      children: [
                        KpiCard(
                          index: 2,
                          label: 'Below 75%',
                          value: '${all!.where((row) => row.flags.contains('LOW_ATTENDANCE')).length}',
                          icon: Icons.trending_down_rounded,
                        ),
                        KpiCard(
                          index: 4,
                          label: 'Repeat absentees',
                          value: '${all.where((row) => row.flags.contains('REPEAT_ABSENTEE')).length}',
                          icon: Icons.event_busy_rounded,
                        ),
                        KpiCard(
                          index: 0,
                          label: 'High priority',
                          value: '${all.where((row) => row.level == RiskLevel.high).length}',
                          icon: Icons.priority_high_rounded,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SegmentedTabs(
                      labels: const ['All', 'High', 'Medium', 'Low'],
                      counts: [
                        all.length,
                        for (final level in RiskLevel.values) all.where((row) => row.level == level).length,
                      ],
                      index: _level == null ? 0 : _level!.index + 1,
                      onChanged: (index) => setState(() => _level = index == 0 ? null : RiskLevel.values[index - 1]),
                    ),
                    const SizedBox(height: 12),
                    if (visible!.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyView(
                          icon: Icons.sentiment_satisfied_alt_rounded,
                          title: 'No students flagged',
                          message: 'Attendance this month is on track.',
                        ),
                      )
                    else
                      for (final row in visible) ...[
                        AppCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => PrincipalStudentProfileScreen(studentId: row.studentId)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(row.studentName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  ),
                                  _levelChip(row.level),
                                ],
                              ),
                              Text(
                                '${row.className} · ${row.attendancePercentage}% attendance · '
                                '${row.absentThisMonth} absence${row.absentThisMonth == 1 ? '' : 's'} this month',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  for (final flag in row.flags)
                                    StatusChip(label: humanizeConstant(flag), color: AppColors.textSecondary, tint: AppColors.background),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                  ],
                ),
              ),
          },
        );
      },
    );
  }
}

StatusChip _levelChip(RiskLevel level) => switch (level) {
      RiskLevel.high => const StatusChip(label: 'High', color: AppColors.danger, tint: AppColors.dangerSoft),
      RiskLevel.medium => const StatusChip(label: 'Medium', color: AppColors.warning, tint: AppColors.warningSoft),
      RiskLevel.low => const StatusChip(label: 'Low', color: AppColors.primary, tint: AppColors.primarySoft),
    };
