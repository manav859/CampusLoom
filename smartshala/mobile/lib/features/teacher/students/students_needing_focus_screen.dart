import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';
import 'student_profile_screen.dart';

class StudentsNeedingFocusScreen extends StatefulWidget {
  const StudentsNeedingFocusScreen({super.key});

  @override
  State<StudentsNeedingFocusScreen> createState() => _StudentsNeedingFocusScreenState();
}

class _StudentsNeedingFocusScreenState extends State<StudentsNeedingFocusScreen> {
  late Future<FocusResult> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<TeacherRepository>().studentsNeedingFocus();
  }

  Future<void> _refresh() async {
    final future = context.read<TeacherRepository>().studentsNeedingFocus();
    setState(() { _future = future; });
    await future.catchError(
      (Object _) => const FocusResult(thresholds: FocusThresholds.fallback, students: []),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Students Needing Focus')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<FocusResult>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const LoadingView(message: 'Checking your students…');
            }

            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  ErrorView(
                    message: snapshot.error is ApiException
                        ? (snapshot.error as ApiException).message
                        : 'Could not load this list.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final result = snapshot.data!;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _ThresholdsCard(thresholds: result.thresholds),
                const SizedBox(height: 18),
                if (result.students.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyView(
                      icon: Icons.verified_rounded,
                      title: 'Nobody is flagged',
                      message: 'No student in your classes is currently below the thresholds.',
                    ),
                  )
                else ...[
                  SectionHeader(title: '${result.students.length} students flagged'),
                  for (final student in result.students) ...[
                    _FocusCard(
                      student: student,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => StudentProfileScreen(studentId: student.studentId),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// States the rules plainly, so a teacher can see why a student was listed.
class _ThresholdsCard extends StatelessWidget {
  const _ThresholdsCard({required this.thresholds});

  final FocusThresholds thresholds;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.rule_rounded, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'How students are flagged',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _Rule(text: 'Attendance below ${thresholds.attendancePercent}%'),
          _Rule(text: 'Exam average below ${thresholds.averageMarksPercent}%'),
          _Rule(
            text: '${thresholds.missingHomeworkCount} or more missing homework items',
          ),
          const SizedBox(height: 8),
          Text(
            'Measured over the last ${thresholds.lookbackDays} days.',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 6, right: 8),
            child: SizedBox(
              width: 4,
              height: 4,
              child: DecoratedBox(
                decoration: BoxDecoration(color: AppColors.textMuted, shape: BoxShape.circle),
              ),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _FocusCard extends StatelessWidget {
  const _FocusCard({required this.student, required this.onTap});

  final FocusStudent student;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final severityColor = student.isHigh ? AppColors.danger : AppColors.warning;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: severityColor.withValues(alpha: 0.12),
                child: Text(
                  student.rollNumber?.toString() ??
                      student.fullName.characters.first.toUpperCase(),
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: severityColor,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      student.fullName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (student.className != null)
                      Text(
                        'Class ${student.className}',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: severityColor.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  student.isHigh ? 'High' : 'Medium',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: severityColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final reason in student.reasons)
                _ReasonChip(label: _reasonLabel(reason), color: severityColor),
            ],
          ),
        ],
      ),
    );
  }

  String _reasonLabel(FocusReason reason) => switch (reason) {
        FocusReason.lowAttendance =>
          'Attendance ${student.attendancePercent ?? 0}%',
        FocusReason.lowMarks => 'Average ${student.averageMarksPercent ?? 0}%',
        FocusReason.missingHomework => '${student.missingHomeworkCount} homework missing',
      };
}

class _ReasonChip extends StatelessWidget {
  const _ReasonChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
