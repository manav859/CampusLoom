import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import 'report_widgets.dart';

class _AttendanceData {
  const _AttendanceData(this.overview, this.rows);

  final AttendanceOverview overview;
  final List<ClassAttendanceRow> rows;
}

/// The web Daily Attendance Report: classes marked, the attendance rate over
/// the marked classes, each class's counts, a nudge for the teachers who have
/// not marked, and the same CSV export.
class AttendanceReportScreen extends StatefulWidget {
  const AttendanceReportScreen({super.key});

  @override
  State<AttendanceReportScreen> createState() => _AttendanceReportScreenState();
}

class _AttendanceReportScreenState extends State<AttendanceReportScreen> {
  ReportRange _range = ReportRange.today;
  late Future<_AttendanceData> _future;
  bool _nudging = false;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_AttendanceData> _load() async {
    final dates = _range.datesAt(DateTime.now());
    final results = await Future.wait<Object>([
      _repository.attendanceOverview(dates),
      _repository.classAttendance(dates),
    ]);
    return _AttendanceData(results[0] as AttendanceOverview, results[1] as List<ClassAttendanceRow>);
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  void _toast(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: isError ? AppColors.danger : AppColors.success));
  }

  Future<void> _nudge() async {
    setState(() => _nudging = true);
    try {
      final result = await _repository.nudgePendingTeachers(_range.datesAt(DateTime.now()));
      if (mounted) _toast('Nudged ${result.sent} of ${result.pending} pending class teachers.');
    } on ApiException catch (error) {
      if (mounted) _toast(error.message, isError: true);
    } finally {
      if (mounted) setState(() => _nudging = false);
    }
  }

  Future<void> _export(List<ClassAttendanceRow> rows) async {
    final dates = _range.datesAt(DateTime.now());
    await shareReportCsv(
      name: 'attendance-report',
      subject: 'Attendance report',
      csv: attendanceCsv(
        schoolName: context.read<AuthController>().user?.schoolName ?? 'School',
        rangeLabel: dates.dateFrom == dates.dateTo ? dates.dateFrom : '${dates.dateFrom} - ${dates.dateTo}',
        rows: rows,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_AttendanceData>(
      future: _future,
      builder: (context, snapshot) {
        final data = snapshot.data;
        final loading = snapshot.connectionState == ConnectionState.waiting;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Attendance Report'),
            actions: [ExportCsvAction(onPressed: data == null || loading ? null : () => _export(data.rows))],
          ),
          body: RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                SegmentedTabs(
                  labels: [for (final range in ReportRange.values) range.label],
                  index: _range.index,
                  onChanged: (index) {
                    setState(() => _range = ReportRange.values[index]);
                    _reload();
                  },
                ),
                const SizedBox(height: 14),
                if (loading)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: LoadingView())
                else if (snapshot.hasError)
                  ErrorView(
                    message: snapshot.error is ApiException
                        ? (snapshot.error as ApiException).message
                        : 'Unable to load attendance reports.',
                    onRetry: _reload,
                  )
                else
                  ..._report(data!),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _report(_AttendanceData data) {
    final overview = data.overview;
    final pending = data.rows.where((row) => !row.marked).toList();

    return [
      ResponsiveGrid(
        phoneColumns: 2,
        wideColumns: 4,
        children: [
          KpiCard(index: 1, label: 'Classes marked', value: '${overview.markedClasses}/${overview.totalClasses}', icon: Icons.fact_check_rounded),
          KpiCard(index: 3, label: 'Attendance', value: '${overview.attendancePercentage}%', icon: Icons.insights_rounded),
          KpiCard(index: 0, label: 'Present', value: '${overview.present}', icon: Icons.how_to_reg_rounded),
          KpiCard(index: 2, label: 'Absent', value: '${overview.absent}', icon: Icons.person_off_rounded),
        ],
      ),
      const SizedBox(height: 16),
      SectionHeader(title: 'Pending Classes (${pending.length})'),
      if (pending.isEmpty)
        const AppCard(
          padding: EdgeInsets.symmetric(vertical: 18),
          child: EmptyView(icon: Icons.task_alt_rounded, title: 'Every class is marked'),
        )
      else ...[
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final row in pending)
              StatusChip(
                label: row.classTeacherName == null ? row.className : '${row.className} · ${row.classTeacherName}',
                color: AppColors.warning,
                tint: AppColors.warningSoft,
              ),
          ],
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _nudging ? null : _nudge,
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
          icon: const Icon(Icons.notifications_active_rounded, size: 18),
          label: Text(_nudging ? 'Nudging…' : 'Nudge Teachers'),
        ),
      ],
      const SizedBox(height: 20),
      const SectionHeader(title: 'Class Wise'),
      if (data.rows.isEmpty)
        const AppCard(
          padding: EdgeInsets.symmetric(vertical: 18),
          child: EmptyView(icon: Icons.class_outlined, title: 'No classes yet'),
        )
      else
        for (final row in data.rows) ...[
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(row.className, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      Text(
                        [
                          row.classTeacherName ?? 'No class teacher',
                          if (row.marked) '${row.present + row.late} present · ${row.absent} absent of ${row.total}',
                        ].join(' · '),
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                row.marked
                    ? percentChip(row.percentage)
                    : const StatusChip(label: 'Pending', color: AppColors.textSecondary, tint: AppColors.background),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
    ];
  }
}
