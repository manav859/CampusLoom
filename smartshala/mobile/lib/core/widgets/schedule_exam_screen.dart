import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../data/exam_models.dart';
import '../theme/app_colors.dart';
import 'state_views.dart';

/// Schedules an exam for a class and subject, with no marks yet. Teachers and
/// principals use the same form: [terms] is what the role may create. Pops the
/// created [ExamSummary], which is then selectable wherever marks are entered.
class ScheduleExamScreen extends StatefulWidget {
  const ScheduleExamScreen({
    super.key,
    required this.loadClasses,
    required this.terms,
    required this.onSubmit,
    this.initialClassId,
  });

  final Future<List<ExamClass>> Function() loadClasses;
  final List<ExamTerm> terms;
  final Future<ExamSummary> Function(NewExam exam) onSubmit;
  final String? initialClassId;

  @override
  State<ScheduleExamScreen> createState() => _ScheduleExamScreenState();
}

class _ScheduleExamScreenState extends State<ScheduleExamScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _maxMarks = TextEditingController(text: '100');
  final _passingMarks = TextEditingController();
  final _description = TextEditingController();

  late Future<List<ExamClass>> _classes;
  String? _classId;
  String? _subjectId;
  late ExamTerm _term = widget.terms.first;
  DateTime _date = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _classId = widget.initialClassId;
    _classes = widget.loadClasses();
  }

  @override
  void dispose() {
    for (final controller in [_name, _maxMarks, _passingMarks, _description]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    try {
      final created = await widget.onSubmit(
        NewExam(
          classId: _classId!,
          subjectId: _subjectId!,
          name: _name.text,
          term: _term,
          maxMarks: double.parse(_maxMarks.text.trim()),
          passingMarks: double.tryParse(_passingMarks.text.trim()),
          date: _date,
          description: _description.text,
        ),
      );
      if (mounted) Navigator.of(context).pop(created);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule Exam')),
      body: FutureBuilder<List<ExamClass>>(
        future: _classes,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(
              message: error is ApiException ? error.message : 'Could not load classes.',
              onRetry: () => setState(() {
                _classes = widget.loadClasses();
              }),
            );
          }

          final classes = snapshot.data!;
          if (classes.isEmpty) {
            return const EmptyView(
              icon: Icons.class_outlined,
              title: 'No classes',
              message: 'An exam needs a class with subjects.',
            );
          }
          final selectedClass = classes.where((item) => item.id == _classId).firstOrNull;
          final subjects = selectedClass?.subjects ?? const [];

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedClass?.id,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Class *'),
                  items: [for (final item in classes) DropdownMenuItem(value: item.id, child: Text(item.label))],
                  onChanged: (value) => setState(() {
                    _classId = value;
                    _subjectId = null;
                  }),
                  validator: (value) => value == null ? 'Choose a class' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  // A new key when the class changes resets the chosen subject.
                  key: ValueKey('subject-$_classId'),
                  initialValue: _subjectId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'Subject *',
                    helperText: selectedClass != null && subjects.isEmpty ? 'This class has no subjects you can examine.' : null,
                  ),
                  items: [for (final subject in subjects) DropdownMenuItem(value: subject.id, child: Text(subject.name))],
                  onChanged: (value) => setState(() => _subjectId = value),
                  validator: (value) => value == null ? 'Choose a subject' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<ExamTerm>(
                  initialValue: _term,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Exam type *'),
                  items: [for (final term in widget.terms) DropdownMenuItem(value: term, child: Text(term.label))],
                  onChanged: (value) => setState(() => _term = value ?? _term),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(labelText: 'Exam name *', hintText: '${_term.label} 1'),
                  validator: (value) {
                    final length = value?.trim().length ?? 0;
                    if (length < 2) return 'Exam name is required.';
                    return length > 160 ? 'Keep it under 160 characters.' : null;
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _maxMarks,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Max marks *'),
                        validator: (value) {
                          final number = double.tryParse(value?.trim() ?? '');
                          if (number == null || number <= 0) return 'Greater than zero';
                          return number > 999 ? 'At most 999' : null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _passingMarks,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Passing marks'),
                        validator: (value) {
                          final text = value?.trim() ?? '';
                          if (text.isEmpty) return null;
                          final number = double.tryParse(text);
                          final max = double.tryParse(_maxMarks.text.trim());
                          if (number == null || number <= 0) return 'Greater than zero';
                          return max != null && number > max ? 'Not above max' : null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Exam date *',
                      suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                    ),
                    child: Text(DateFormat('EEE, d MMM yyyy').format(_date)),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _description,
                  maxLines: 3,
                  maxLength: 1000,
                  decoration: const InputDecoration(labelText: 'Description', counterText: ''),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerSoft,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                    ),
                    child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Scheduling…' : 'Schedule Exam'),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Marks are entered per student once the exam is scheduled.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
