import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';
import 'widgets/attendance_bits.dart';

String _qualitative(int pct) {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Good';
  if (pct >= 60) return 'Fair';
  if (pct > 0) return 'Needs work';
  return '—';
}

String _termLabel(String? term) => switch (term) {
      'UNIT_TEST' => 'Unit Test',
      'CLASS_TEST' => 'Class Test',
      'MID_TERM' => 'Mid Term',
      'FINAL' => 'Final',
      'TERM_1' => 'Term 1',
      'TERM_2' => 'Term 2',
      _ => '',
    };

/// A child's exam performance: an overall figure and each exam's per-subject
/// marks and grades.
class ParentAcademicsScreen extends StatefulWidget {
  const ParentAcademicsScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentAcademicsScreen> createState() => _ParentAcademicsScreenState();
}

class _ParentAcademicsScreenState extends State<ParentAcademicsScreen> {
  ChildAcademics? _data;
  String? _error;
  bool _loading = true;

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
      final data = await context.read<ParentRepository>().academics(widget.childId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Academic Performance'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(widget.childName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _content(_data!),
      ),
    );
  }

  Widget _content(ChildAcademics data) {
    if (data.exams.isEmpty) {
      return const EmptyView(
        icon: Icons.school_outlined,
        title: 'No results yet',
        message: 'Exam results will appear here once the school enters them.',
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        HomeSurface(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              AttendanceRing(percentage: data.overallPercentage.toDouble()),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Overall performance',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _qualitative(data.overallPercentage),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.success),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Grade ${data.overallGrade} · across ${data.exams.length} exam${data.exams.length == 1 ? '' : 's'}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        for (final exam in data.exams) ...[
          const SizedBox(height: 10),
          _ExamCard(exam: exam),
        ],
      ],
    );
  }
}

class _ExamCard extends StatelessWidget {
  const _ExamCard({required this.exam});

  final ExamResultGroup exam;

  @override
  Widget build(BuildContext context) {
    final term = _termLabel(exam.term);
    final sub = [
      if (term.isNotEmpty) term,
      if (exam.date != null) DateFormat('d MMM yyyy').format(exam.date!),
    ].join(' · ');

    return HomeSurface(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      exam.name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    if (sub.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(sub, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5)),
                    ],
                  ],
                ),
              ),
              _GradePill(percentage: exam.percentage, grade: exam.grade),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.border),
          _row('Subject', 'Marks', 'Grade', header: true),
          for (final s in exam.subjects) _row(s.subject, s.isAbsent ? 'Absent' : s.marks, s.isAbsent ? '—' : s.grade),
        ],
      ),
    );
  }

  Widget _row(String a, String b, String c, {bool header = false}) {
    final style = TextStyle(
      fontSize: 13,
      fontWeight: header ? FontWeight.w600 : FontWeight.w500,
      color: header ? AppColors.textMuted : AppColors.textPrimary,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(flex: 5, child: Text(a, style: style)),
          Expanded(flex: 3, child: Text(b, style: style, textAlign: TextAlign.center)),
          Expanded(flex: 2, child: Text(c, style: style, textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}

class _GradePill extends StatelessWidget {
  const _GradePill({required this.percentage, required this.grade});

  final int percentage;
  final String grade;

  @override
  Widget build(BuildContext context) {
    final color = percentage >= 75
        ? AppColors.success
        : percentage >= 50
            ? AppColors.warning
            : AppColors.danger;
    final ground = percentage >= 75
        ? AppColors.successSoft
        : percentage >= 50
            ? AppColors.warningSoft
            : AppColors.dangerSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: ground, borderRadius: BorderRadius.circular(10)),
      child: Text(
        '$percentage% · $grade',
        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
