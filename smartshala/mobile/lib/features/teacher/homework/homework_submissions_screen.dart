import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';

/// The "Submissions" side of Homework: mark who handed work in.
class HomeworkSubmissionsScreen extends StatefulWidget {
  const HomeworkSubmissionsScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  State<HomeworkSubmissionsScreen> createState() => _HomeworkSubmissionsScreenState();
}

class _HomeworkSubmissionsScreenState extends State<HomeworkSubmissionsScreen> {
  HomeworkDetail? _detail;
  String? _error;
  bool _loading = true;
  final _saving = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail = await context.read<TeacherRepository>().homeworkAssignment(widget.assignmentId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _setStatus(HomeworkSubmission submission, SubmissionStatus status) async {
    final previous = submission.status;
    setState(() {
      submission.status = status;
      _saving.add(submission.studentId);
    });

    try {
      await context.read<TeacherRepository>().updateSubmission(
            assignmentId: widget.assignmentId,
            studentId: submission.studentId,
            status: status,
          );
    } on ApiException catch (error) {
      if (!mounted) return;
      // Put the row back the way it was — the server is the source of truth.
      setState(() => submission.status = previous);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _saving.remove(submission.studentId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;

    return Scaffold(
      appBar: AppBar(title: const Text('Submissions')),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : detail == null
                  ? const SizedBox.shrink()
                  : Column(
                      children: [
                        _Header(assignment: detail.assignment),
                        Expanded(
                          child: detail.submissions.isEmpty
                              ? const EmptyView(
                                  icon: Icons.groups_2_rounded,
                                  title: 'No students',
                                  message: 'This class has no active students.',
                                )
                              : ListView.separated(
                                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                                  itemCount: detail.submissions.length,
                                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                                  itemBuilder: (context, index) {
                                    final submission = detail.submissions[index];
                                    return _SubmissionRow(
                                      submission: submission,
                                      busy: _saving.contains(submission.studentId),
                                      onChanged: (status) => _setStatus(submission, status),
                                    );
                                  },
                                ),
                        ),
                      ],
                    ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.assignment});

  final HomeworkAssignment assignment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              assignment.title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Class ${assignment.className} • ${assignment.subject} • '
              'due ${DateFormat('d MMM').format(assignment.dueDate)}',
              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _Chip(
                  label: '${assignment.submittedCount} on time',
                  color: AppColors.success,
                ),
                const SizedBox(width: 8),
                _Chip(label: '${assignment.lateCount} late', color: AppColors.warning),
                const SizedBox(width: 8),
                _Chip(
                  label: '${assignment.notSubmittedCount} pending',
                  color: AppColors.danger,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

class _SubmissionRow extends StatelessWidget {
  const _SubmissionRow({
    required this.submission,
    required this.busy,
    required this.onChanged,
  });

  final HomeworkSubmission submission;
  final bool busy;
  final ValueChanged<SubmissionStatus> onChanged;

  static const _cycle = [
    SubmissionStatus.notSubmitted,
    SubmissionStatus.onTime,
    SubmissionStatus.late,
    SubmissionStatus.missing,
  ];

  Color get _color => switch (submission.status) {
        SubmissionStatus.onTime => AppColors.success,
        SubmissionStatus.late => AppColors.warning,
        SubmissionStatus.missing => AppColors.danger,
        SubmissionStatus.notSubmitted => AppColors.textMuted,
      };

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 17,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              submission.rollNumber?.toString() ?? '–',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              submission.studentName,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          if (busy)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2.2),
            )
          else
            PopupMenuButton<SubmissionStatus>(
              onSelected: onChanged,
              tooltip: 'Change status',
              itemBuilder: (context) => _cycle
                  .map(
                    (status) => PopupMenuItem(
                      value: status,
                      child: Text(status.label),
                    ),
                  )
                  .toList(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: _color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _color.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      submission.status.label,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: _color,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(Icons.expand_more_rounded, size: 15, color: _color),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
