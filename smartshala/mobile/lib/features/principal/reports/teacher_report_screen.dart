import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import '../data/teacher_models.dart';
import '../teachers/teacher_profile_screen.dart';
import 'report_widgets.dart';

/// The web Teacher Performance report: today's periods and subjects from the
/// timetable, and which of each teacher's classes have attendance marked today.
class TeacherReportScreen extends StatefulWidget {
  const TeacherReportScreen({super.key});

  @override
  State<TeacherReportScreen> createState() => _TeacherReportScreenState();
}

class _TeacherReportScreenState extends State<TeacherReportScreen> {
  late Future<List<TeacherReportRow>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<TeacherReportRow>> _load() async {
    final repository = context.read<PrincipalRepository>();
    final now = DateTime.now();
    final results = await Future.wait<Object>([
      repository.teachers(),
      repository.classAttendance(ReportRange.today.datesAt(now)),
    ]);
    return teacherReport(results[0] as List<TeacherRow>, results[1] as List<ClassAttendanceRow>, now);
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _export(List<TeacherReportRow> rows) => shareReportCsv(
        name: 'teacher-performance',
        subject: 'Teacher performance',
        csv: toCsv([
          ['Teacher', 'Phone', 'Class teacher for', 'Assigned periods', 'Subjects', 'Attendance marked', 'Attendance pending', 'Status'],
          for (final row in rows)
            [
              row.teacher.fullName,
              row.teacher.phone,
              row.teacher.classTeacherFor.isEmpty ? '-' : row.teacher.classTeacherLabels.join(', '),
              row.periodsToday,
              row.subjectsToday.join('; '),
              row.markedClasses.isEmpty ? '-' : row.markedClasses.join(', '),
              row.pendingClasses.isEmpty ? '-' : row.pendingClasses.join(', '),
              row.teacher.status,
            ],
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<TeacherReportRow>>(
      future: _future,
      builder: (context, snapshot) {
        final rows = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Teacher Report'),
            actions: [ExportCsvAction(onPressed: rows == null || rows.isEmpty ? null : () => _export(rows))],
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load teacher performance report.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    if (rows!.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyView(icon: Icons.badge_outlined, title: 'No teachers found.'),
                      )
                    else
                      for (final row in rows) ...[
                        AppCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => TeacherProfileScreen(teacherId: row.teacher.id)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(row.teacher.fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  ),
                                  row.teacher.isActive
                                      ? const StatusChip(label: 'Active', color: AppColors.success, tint: AppColors.successSoft)
                                      : const StatusChip(label: 'Inactive', color: AppColors.warning, tint: AppColors.warningSoft),
                                ],
                              ),
                              Text(
                                [
                                  '${row.periodsToday} period${row.periodsToday == 1 ? '' : 's'} today',
                                  if (row.subjectsToday.isNotEmpty) row.subjectsToday.join(', '),
                                  if (row.teacher.classTeacherFor.isNotEmpty) 'Class teacher ${row.teacher.classTeacherLabels.join(', ')}',
                                ].join(' · '),
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              if (row.markedClasses.isNotEmpty || row.pendingClasses.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    for (final name in row.markedClasses)
                                      StatusChip(label: '$name marked', color: AppColors.success, tint: AppColors.successSoft),
                                    for (final name in row.pendingClasses)
                                      StatusChip(label: '$name pending', color: AppColors.warning, tint: AppColors.warningSoft),
                                  ],
                                ),
                              ],
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
