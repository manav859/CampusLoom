import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/exam_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/marks_entry_dialog.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import 'exams_screen.dart';

/// One exam's results. Unlike a teacher, whose marks lock once saved, the
/// principal can tap any student to enter or amend their marks.
class ExamResultsScreen extends StatefulWidget {
  const ExamResultsScreen({super.key, required this.examId});

  final String examId;

  @override
  State<ExamResultsScreen> createState() => _ExamResultsScreenState();
}

class _ExamResultsScreenState extends State<ExamResultsScreen> {
  late Future<ExamDetail> _future;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _future = _repository.exam(widget.examId);
  }

  Future<void> _reload() async {
    final future = _repository.exam(widget.examId);
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _edit(ExamDetail detail, ExamStudentResult student) async {
    final entry = await showDialog<MarksEntry>(
      context: context,
      builder: (_) => MarksEntryDialog(student: student, maxMarks: detail.exam.maxMarks),
    );
    if (entry == null || !mounted) return;
    try {
      await _repository.saveExamResult(
        examId: detail.exam.id,
        studentId: student.studentId,
        marks: entry.marks,
        isAbsent: entry.isAbsent,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text('Saved marks for ${student.fullName}.')));
      await _reload();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exam Results')),
      body: FutureBuilder<ExamDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(message: error is ApiException ? error.message : 'Could not load this exam.', onRetry: _reload);
          }

          final detail = snapshot.data!;
          final exam = detail.exam;
          final max = exam.maxMarks.toStringAsFixed(0);

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(exam.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
                          examStageChip(exam.stageAt(DateTime.now())),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          exam.className,
                          exam.subject,
                          if (exam.term != null) exam.term!.label,
                          DateFormat('d MMM yyyy').format(exam.date),
                        ].join(' · '),
                        style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                      ),
                      if (exam.description?.trim().isNotEmpty ?? false) ...[
                        const SizedBox(height: 8),
                        Text(exam.description!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                ResponsiveGrid(
                  phoneColumns: 2,
                  wideColumns: 4,
                  children: [
                    KpiCard(index: 1, label: 'Class average', value: '${exam.classAverage}%', icon: Icons.timeline_rounded),
                    KpiCard(index: 4, label: 'Max marks', value: max, icon: Icons.workspace_premium_rounded),
                    KpiCard(index: 3, label: 'Entered', value: '${exam.enteredCount}', icon: Icons.task_alt_rounded),
                    KpiCard(index: 2, label: 'Pending', value: '${exam.pendingCount}', icon: Icons.pending_actions_rounded),
                  ],
                ),
                if (detail.topPerformers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Top Performers'),
                  AppCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: Column(
                      children: [
                        for (var index = 0; index < detail.topPerformers.length; index++) ...[
                          if (index > 0) const Divider(),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              children: [
                                Text('${index + 1}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.warning)),
                                const SizedBox(width: 12),
                                Expanded(child: Text(detail.topPerformers[index].fullName, style: const TextStyle(fontWeight: FontWeight.w600))),
                                Text(
                                  '${detail.topPerformers[index].marks!.toStringAsFixed(0)}/$max',
                                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                const SectionHeader(title: 'Student Marks'),
                if (detail.students.isEmpty)
                  const AppCard(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: EmptyView(icon: Icons.groups_outlined, title: 'No active students in this class'),
                  )
                else
                  for (final student in detail.students) ...[
                    _StudentRow(student: student, maxMarks: max, onTap: () => _edit(detail, student)),
                    const SizedBox(height: 8),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.student, required this.maxMarks, required this.onTap});

  final ExamStudentResult student;
  final String maxMarks;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = student.isAbsent
        ? AppColors.textMuted
        : !student.hasResult
            ? AppColors.warning
            : (student.percentage ?? 0) >= 40
                ? AppColors.success
                : AppColors.danger;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 17,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              student.rollNumber?.toString() ?? '–',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(student.fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
          Text(
            student.isAbsent
                ? 'Absent'
                : student.hasResult
                    ? '${student.marks!.toStringAsFixed(0)}/$maxMarks${student.grade == null ? '' : ' · ${student.grade}'}'
                    : 'Not entered',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color),
          ),
          const SizedBox(width: 6),
          const Icon(Icons.edit_rounded, size: 16, color: AppColors.textMuted),
        ],
      ),
    );
  }
}
