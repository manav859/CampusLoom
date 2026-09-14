import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/exam_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/schedule_exam_screen.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/student_models.dart' show ClassChoice;
import '../widgets/management_widgets.dart';
import 'exam_results_screen.dart';

/// Exams: every exam in the school, by class and stage, with Schedule Exam.
/// A scheduled exam is what teachers pick in their Marks screen, and tapping
/// one here shows its results, where the principal can enter or amend marks.
class ExamsScreen extends StatefulWidget {
  const ExamsScreen({super.key});

  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  List<ClassChoice> _classes = const [];
  ClassChoice? _class;
  ExamStage? _stage;

  List<ExamSummary> _exams = const [];
  bool _loading = true;
  String? _error;
  int _generation = 0;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _repository.classes().then((classes) {
      if (mounted) setState(() => _classes = classes);
    }, onError: (Object _) {});
    _load();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final exams = await _repository.exams(classId: _class?.id);
      if (!mounted || generation != _generation) return;
      setState(() {
        _exams = exams;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _schedule() async {
    final created = await Navigator.of(context).push<ExamSummary>(
      MaterialPageRoute(
        builder: (_) => ScheduleExamScreen(
          loadClasses: _repository.examClasses,
          terms: ExamTerm.values,
          onSubmit: _repository.scheduleExam,
          initialClassId: _class?.id,
        ),
      ),
    );
    if (created == null || !mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text('${created.name} scheduled for ${created.className}.'),
      ));
    await _load();
  }

  Future<void> _open(ExamSummary exam) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => ExamResultsScreen(examId: exam.id)));
    if (mounted) await _load();
  }

  Future<void> _pickClass() async {
    final picked = await pickFromSheet<ClassChoice?>(
      context,
      title: 'Class',
      options: [(label: 'All Classes', value: null), for (final item in _classes) (label: item.label, value: item)],
      selected: _class,
    );
    if (picked == null || picked.value?.id == _class?.id) return;
    setState(() => _class = picked.value);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final counts = {for (final stage in ExamStage.values) stage: _exams.where((exam) => exam.stageAt(now) == stage).length};
    final visible = _stage == null ? _exams : _exams.where((exam) => exam.stageAt(now) == _stage).toList();
    const stages = [null, ExamStage.scheduled, ExamStage.marksPending, ExamStage.complete];

    return Scaffold(
      appBar: AppBar(title: const Text('Exams')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _schedule,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Schedule Exam'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: FilterChipButton(label: _class?.label ?? 'All Classes', active: _class != null, onTap: _pickClass),
            ),
            const SizedBox(height: 10),
            SegmentedTabs(
              labels: [for (final stage in stages) stage?.label ?? 'All'],
              counts: [for (final stage in stages) stage == null ? _exams.length : counts[stage]!],
              index: stages.indexOf(_stage),
              onChanged: (index) => setState(() => _stage = stages[index]),
            ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: LoadingView())
            else if (_error != null)
              ErrorView(message: _error!, onRetry: _load)
            else if (visible.isEmpty)
              const AppCard(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: EmptyView(
                  icon: Icons.assignment_outlined,
                  title: 'No exams here',
                  message: 'Schedule an exam and teachers can enter its marks.',
                ),
              )
            else
              for (final exam in visible) ...[
                ExamSummaryCard(exam: exam, now: now, onTap: () => _open(exam)),
                const SizedBox(height: 8),
              ],
          ],
        ),
      ),
    );
  }
}

StatusChip examStageChip(ExamStage stage) => switch (stage) {
      ExamStage.scheduled => StatusChip(label: stage.label, color: AppColors.primary, tint: AppColors.primarySoft),
      ExamStage.marksPending => StatusChip(label: stage.label, color: AppColors.warning, tint: AppColors.warningSoft),
      ExamStage.complete => StatusChip(label: stage.label, color: AppColors.success, tint: AppColors.successSoft),
    };

class ExamSummaryCard extends StatelessWidget {
  const ExamSummaryCard({super.key, required this.exam, required this.now, this.onTap});

  final ExamSummary exam;
  final DateTime now;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final total = exam.enteredCount + exam.pendingCount;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(exam.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(
                      [
                        exam.className,
                        exam.subject,
                        if (exam.term != null) exam.term!.label,
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              examStageChip(exam.stageAt(now)),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.event_rounded, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(DateFormat('d MMM yyyy').format(exam.date), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
              Text(
                '${exam.enteredCount}/$total entered${exam.enteredCount > 0 ? ' · avg ${exam.classAverage}%' : ''}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
