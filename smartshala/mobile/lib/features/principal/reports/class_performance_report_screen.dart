import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/exam_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import 'report_widgets.dart';

/// Class Wise Performance: each class's attendance this month (GET
/// /analytics/classes) beside its exam average (GET /marks/exams).
class ClassPerformanceReportScreen extends StatefulWidget {
  const ClassPerformanceReportScreen({super.key});

  @override
  State<ClassPerformanceReportScreen> createState() => _ClassPerformanceReportScreenState();
}

class _ClassPerformanceReportScreenState extends State<ClassPerformanceReportScreen> {
  late Future<List<ClassPerformanceRow>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ClassPerformanceRow>> _load() async {
    final repository = context.read<PrincipalRepository>();
    final results = await Future.wait<Object>([repository.classPerformance(), repository.exams()]);
    final exams = results[1] as List<ExamSummary>;
    return [for (final row in results[0] as List<ClassPerformanceRow>) row.withExams(exams)];
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _export(List<ClassPerformanceRow> rows) => shareReportCsv(
        name: 'class-performance',
        subject: 'Class wise performance',
        csv: toCsv([
          ['Class', 'Students', 'Days marked this month', 'Attendance', 'Status', 'Exams', 'Exam average'],
          for (final row in rows)
            [
              row.className,
              row.studentCount,
              row.markedDays,
              '${row.attendancePercentage}%',
              row.status,
              row.examCount,
              row.examAverage == null ? '' : '${row.examAverage}%',
            ],
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<ClassPerformanceRow>>(
      future: _future,
      builder: (context, snapshot) {
        final rows = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Class Wise Performance'),
            actions: [ExportCsvAction(onPressed: rows == null || rows.isEmpty ? null : () => _export(rows))],
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load class performance.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    const Text(
                      'Attendance counts this month’s marked days. Exam average weighs each exam by the marks entered.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    if (rows!.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyView(icon: Icons.class_outlined, title: 'No classes yet'),
                      )
                    else
                      for (final row in rows) ...[
                        AppCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(row.className, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                                  ),
                                  StatusChip(
                                    label: row.status,
                                    color: switch (row.status) {
                                      'Healthy' => AppColors.success,
                                      'Watch' => AppColors.warning,
                                      _ => AppColors.danger,
                                    },
                                    tint: switch (row.status) {
                                      'Healthy' => AppColors.successSoft,
                                      'Watch' => AppColors.warningSoft,
                                      _ => AppColors.dangerSoft,
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${row.studentCount} students · ${row.markedDays} days marked this month',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(child: _Metric(label: 'Attendance', chip: percentChip(row.attendancePercentage))),
                                  Expanded(
                                    child: _Metric(
                                      label: row.examCount == 1 ? '1 exam' : '${row.examCount} exams',
                                      chip: percentChip(row.examAverage, suffix: '% avg'),
                                    ),
                                  ),
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

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.chip});

  final String label;
  final Widget chip;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
        const SizedBox(height: 4),
        chip,
      ],
    );
  }
}
