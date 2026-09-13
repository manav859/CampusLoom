import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_models.dart';
import '../data/teacher_repository.dart';
import '../widgets/picker_field.dart';

class MarksScreen extends StatefulWidget {
  const MarksScreen({super.key});

  @override
  State<MarksScreen> createState() => _MarksScreenState();
}

class _MarksScreenState extends State<MarksScreen> {
  List<ClassOption> _classes = const [];
  ClassOption? _selectedClass;

  List<ExamSummary> _exams = const [];
  ExamSummary? _selectedExam;

  ExamDetail? _detail;
  bool _loadingClasses = true;
  bool _loadingExams = false;
  bool _loadingDetail = false;
  String? _error;

  TeacherRepository get _repository => context.read<TeacherRepository>();

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loadingClasses = true;
      _error = null;
    });

    try {
      final classes = await _repository.marksContext();
      if (!mounted) return;
      setState(() {
        _classes = classes.map((item) => item.asOption).toList();
        _selectedClass = _classes.firstOrNull;
        _loadingClasses = false;
      });
      if (_selectedClass != null) await _loadExams();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingClasses = false;
      });
    }
  }

  Future<void> _loadExams() async {
    final selected = _selectedClass;
    if (selected == null) return;

    setState(() {
      _loadingExams = true;
      _detail = null;
      _selectedExam = null;
    });

    try {
      final exams = await _repository.exams(classId: selected.id);
      if (!mounted) return;
      setState(() {
        _exams = exams;
        _selectedExam = exams.firstOrNull;
        _loadingExams = false;
      });
      if (_selectedExam != null) await _loadDetail();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingExams = false;
      });
    }
  }

  Future<void> _loadDetail() async {
    final exam = _selectedExam;
    if (exam == null) return;

    setState(() => _loadingDetail = true);
    try {
      final detail = await _repository.exam(exam.id);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loadingDetail = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingDetail = false;
      });
    }
  }

  Future<void> _editMarks(ExamStudentResult student) async {
    final exam = _selectedExam;
    if (exam == null) return;

    final result = await showDialog<_MarksEntry>(
      context: context,
      builder: (_) => _MarksDialog(student: student, maxMarks: exam.maxMarks),
    );
    if (result == null) return;

    try {
      await _repository.updateExamResult(
        examId: exam.id,
        studentId: student.studentId,
        marks: result.marks,
        isAbsent: result.isAbsent,
      );
      await _loadDetail();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Saved marks for ${student.fullName}.'),
          ),
        );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Marks')),
      body: _loadingClasses
          ? const LoadingView(message: 'Loading your classes…')
          : _error != null && _detail == null
              ? ErrorView(message: _error!, onRetry: _loadClasses)
              : _classes.isEmpty
                  ? const EmptyView(
                      icon: Icons.class_outlined,
                      title: 'No classes assigned',
                      message: 'You are not assigned to any class yet.')
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      children: [
                        PickerField<ClassOption>(
                          label: 'Class',
                          value: _selectedClass,
                          items: _classes,
                          labelOf: (item) => item.label,
                          idOf: (item) => item.id,
                          onChanged: (item) {
                            setState(() => _selectedClass = item);
                            _loadExams();
                          },
                        ),
                        const SizedBox(height: 14),
                        if (_loadingExams)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 30),
                            child: LoadingView(),
                          )
                        else if (_exams.isEmpty)
                          const AppCard(
                            padding: EdgeInsets.symmetric(vertical: 28),
                            child: EmptyView(
                              icon: Icons.assignment_outlined,
                              title: 'No exams for this class',
                              message: 'Exams created by your school will appear here.',
                            ),
                          )
                        else ...[
                          PickerField<ExamSummary>(
                            label: 'Exam',
                            value: _selectedExam,
                            items: _exams,
                            labelOf: (item) => '${item.name} • ${item.subject}',
                            idOf: (item) => item.id,
                            onChanged: (item) {
                              setState(() => _selectedExam = item);
                              _loadDetail();
                            },
                          ),
                          const SizedBox(height: 18),
                          if (_loadingDetail)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 30),
                              child: LoadingView(),
                            )
                          else if (_detail != null) ...[
                            _Summary(detail: _detail!),
                            const SizedBox(height: 18),
                            if (_detail!.topPerformers.isNotEmpty) ...[
                              const SectionHeader(title: 'Top Performers'),
                              _TopPerformers(
                                performers: _detail!.topPerformers,
                                maxMarks: _detail!.exam.maxMarks,
                              ),
                              const SizedBox(height: 18),
                            ],
                            SectionHeader(
                              title: 'Student Marks',
                              action: Text(
                                '${_detail!.exam.enteredCount} entered',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const _SubmittedOnceNote(),
                            const SizedBox(height: 10),
                            for (final student in _detail!.students) ...[
                              _StudentMarksRow(
                                student: student,
                                maxMarks: _detail!.exam.maxMarks,
                                // Submitted marks are locked to teachers; only a
                                // principal or admin can amend them.
                                onTap: student.hasResult ? null : () => _editMarks(student),
                              ),
                              const SizedBox(height: 8),
                            ],
                          ],
                        ],
                      ],
                    ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.detail});

  final ExamDetail detail;

  @override
  Widget build(BuildContext context) {
    final exam = detail.exam;

    return Row(
      children: [
        Expanded(
          child: StatTile(
            value: '${exam.classAverage}%',
            label: 'Class Average',
            icon: Icons.timeline_rounded,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StatTile(
            value: exam.maxMarks.toStringAsFixed(0),
            label: 'Max Marks',
            icon: Icons.workspace_premium_rounded,
            color: AppColors.purple,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StatTile(
            value: '${exam.pendingCount}',
            label: 'Pending',
            icon: Icons.pending_actions_rounded,
            color: AppColors.warning,
          ),
        ),
      ],
    );
  }
}

class _TopPerformers extends StatelessWidget {
  const _TopPerformers({required this.performers, required this.maxMarks});

  final List<ExamStudentResult> performers;
  final double maxMarks;

  @override
  Widget build(BuildContext context) {
    const medals = [AppColors.warning, AppColors.textMuted, Color(0xFFB07D46)];

    return AppCard(
      child: Column(
        children: [
          for (var index = 0; index < performers.length; index++) ...[
            Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: medals[index].withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: medals[index],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    performers[index].fullName,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  '${performers[index].marks?.toStringAsFixed(0) ?? '–'}/${maxMarks.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            if (index != performers.length - 1)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1),
              ),
          ],
        ],
      ),
    );
  }
}

/// The server accepts a teacher's marks once and then locks the row, so the
/// screen says as much rather than letting a tap fail with a 403.
class _SubmittedOnceNote extends StatelessWidget {
  const _SubmittedOnceNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline_rounded, size: 17, color: AppColors.primary),
          const SizedBox(width: 9),
          const Expanded(
            child: Text(
              'Tap a student to enter marks. Once submitted, only your principal '
              'can change them.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentMarksRow extends StatelessWidget {
  const _StudentMarksRow({
    required this.student,
    required this.maxMarks,
    required this.onTap,
  });

  final ExamStudentResult student;
  final double maxMarks;
  final VoidCallback? onTap;

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
              student.fullName,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Text(
            student.isAbsent
                ? 'Absent'
                : student.hasResult
                    ? '${student.marks!.toStringAsFixed(0)}/${maxMarks.toStringAsFixed(0)}'
                    : 'Not entered',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color),
          ),
          const SizedBox(width: 6),
          Icon(
            onTap == null ? Icons.lock_outline_rounded : Icons.edit_rounded,
            size: 16,
            color: AppColors.textMuted,
          ),
        ],
      ),
    );
  }
}

class _MarksEntry {
  const _MarksEntry({required this.marks, required this.isAbsent});

  final double marks;
  final bool isAbsent;
}

class _MarksDialog extends StatefulWidget {
  const _MarksDialog({required this.student, required this.maxMarks});

  final ExamStudentResult student;
  final double maxMarks;

  @override
  State<_MarksDialog> createState() => _MarksDialogState();
}

class _MarksDialogState extends State<_MarksDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.student.marks?.toStringAsFixed(0) ?? '');
  late bool _isAbsent = widget.student.isAbsent;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    if (_isAbsent) {
      Navigator.of(context).pop(const _MarksEntry(marks: 0, isAbsent: true));
      return;
    }

    final marks = double.tryParse(_controller.text.trim());
    if (marks == null || marks < 0) {
      setState(() => _error = 'Enter a number of marks');
      return;
    }
    if (marks > widget.maxMarks) {
      setState(() => _error = 'Cannot exceed ${widget.maxMarks.toStringAsFixed(0)}');
      return;
    }

    Navigator.of(context).pop(_MarksEntry(marks: marks, isAbsent: false));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: Text(widget.student.fullName),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            autofocus: !_isAbsent,
            enabled: !_isAbsent,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Marks out of ${widget.maxMarks.toStringAsFixed(0)}',
              errorText: _error,
            ),
            onChanged: (_) => setState(() => _error = null),
          ),
          const SizedBox(height: 6),
          CheckboxListTile(
            value: _isAbsent,
            onChanged: (value) => setState(() => _isAbsent = value ?? false),
            title: const Text('Marked absent', style: TextStyle(fontSize: 14)),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _save,
          style: FilledButton.styleFrom(minimumSize: const Size(88, 42)),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
