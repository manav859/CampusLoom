import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';
import '../students/student_profile_screen.dart';
import '../widgets/management_widgets.dart';
import 'class_form_screen.dart';

class _ClassData {
  const _ClassData(this.row, this.stats, this.students);

  final ClassRow row;
  final ClassStats? stats;
  final List<ClassStudent> students;
}

/// One class, as on the web class page: the last 30 days' attendance, marks
/// and fee collection, its details and subjects, and its students. Pops `true`
/// when edited.
class ClassDetailScreen extends StatefulWidget {
  const ClassDetailScreen({super.key, required this.classId});

  final String classId;

  @override
  State<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends State<ClassDetailScreen> {
  late Future<_ClassData> _future;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ClassData> _load() async {
    final repository = context.read<PrincipalRepository>();
    final results = await Future.wait<Object?>([
      repository.classDetail(widget.classId),
      repository.classStats(widget.classId).then<ClassStats?>((value) => value, onError: (Object _) => null),
      repository.classStudents(widget.classId),
    ]);
    return _ClassData(results[0]! as ClassRow, results[1] as ClassStats?, results[2]! as List<ClassStudent>);
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _edit(ClassRow row) async {
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => ClassFormScreen(existing: row)));
    if (saved != true || !mounted) return;
    _changed = true;
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: FutureBuilder<_ClassData>(
        future: _future,
        builder: (context, snapshot) {
          final data = snapshot.data;
          return Scaffold(
            appBar: AppBar(
              title: Text(data == null ? 'Class' : 'Class ${data.row.label}'),
              actions: [
                if (data != null)
                  IconButton(tooltip: 'Edit class', onPressed: () => _edit(data.row), icon: const Icon(Icons.edit_rounded)),
              ],
            ),
            body: switch (snapshot) {
              AsyncSnapshot(connectionState: ConnectionState.waiting) when data == null => const LoadingView(),
              AsyncSnapshot(hasError: true, :final error) => ErrorView(
                  message: error is ApiException ? error.message : 'Could not load this class.',
                  onRetry: _reload,
                ),
              _ => RefreshIndicator(onRefresh: _reload, child: _body(data!)),
            },
          );
        },
      ),
    );
  }

  Widget _body(_ClassData data) {
    final row = data.row;
    final stats = data.stats;
    String percent(int? value) => value == null ? '—' : '$value%';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        ResponsiveGrid(
          phoneColumns: 3,
          wideColumns: 3,
          children: [
            KpiCard(index: 3, label: 'Attendance', value: percent(stats?.attendancePercent), icon: Icons.fact_check_rounded),
            KpiCard(index: 1, label: 'Marks avg', value: percent(stats?.marksAveragePercent), icon: Icons.insights_rounded),
            KpiCard(index: 0, label: 'Fees collected', value: percent(stats?.feeCollectionPercent), icon: Icons.savings_rounded),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 6, bottom: 14),
          child: Text('Last 30 days', style: TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
        ),
        InfoSection(title: 'Class Information', lines: [
          ('Class teacher', row.classTeacherName ?? 'Not assigned'),
          ('Academic year', row.academicYear),
          ('Students', row.maximumStrength == null ? '${row.studentCount}' : '${row.studentCount} of ${row.maximumStrength}'),
          ('Medium', row.mediumOfInstruction),
          ('Stream', row.stream),
        ]),
        SectionHeader(title: 'Subjects (${row.subjects.length})'),
        if (row.subjects.isEmpty)
          const Text('No subjects yet.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary))
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final subject in row.subjects)
                StatusChip(label: subject.name, color: AppColors.purple, tint: AppColors.purpleSoft),
            ],
          ),
        const SizedBox(height: 18),
        SectionHeader(title: 'Students (${data.students.length})'),
        if (data.students.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: EmptyView(icon: Icons.groups_outlined, title: 'No students in this class yet'),
          )
        else
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Column(
              children: [
                for (var index = 0; index < data.students.length; index++) ...[
                  if (index > 0) const Divider(),
                  ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: AppColors.primarySoft,
                      child: Text(
                        data.students[index].rollNumber?.toString() ?? '–',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                    ),
                    title: Text(data.students[index].fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(data.students[index].admissionNumber),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => PrincipalStudentProfileScreen(studentId: data.students[index].id),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}
