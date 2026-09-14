import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';
import '../data/teacher_models.dart';

class _FormData {
  const _FormData(this.teachers, this.academicYear);

  final List<TeacherRow> teachers;
  final String academicYear;
}

/// Add or edit a class: the web New Class form's fields. A new class goes in
/// the school's current academic year, which is the year the class list shows.
/// Its class teacher sees it at once in Mark Attendance, Homework and Marks.
/// Pops `true` when saved.
class ClassFormScreen extends StatefulWidget {
  const ClassFormScreen({super.key, this.existing});

  final ClassRow? existing;

  @override
  State<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends State<ClassFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _section = TextEditingController(text: widget.existing?.section ?? '');
  late final _strength = TextEditingController(text: widget.existing?.maximumStrength?.toString() ?? '');
  late final _stream = TextEditingController(text: widget.existing?.stream ?? '');
  late final _medium = TextEditingController(text: widget.existing?.mediumOfInstruction ?? 'English');
  final _customSubject = TextEditingController();

  late Future<_FormData> _future;
  late String? _teacherId = widget.existing?.classTeacherId;
  late List<String> _subjects = widget.existing == null
      ? [...defaultClassSubjects]
      : [for (final subject in widget.existing!.subjects) subject.name];
  bool _saving = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_FormData> _load() async {
    final repository = context.read<PrincipalRepository>();
    final results = await Future.wait<Object?>([
      repository.teachers(),
      _editing ? Future<String?>.value(widget.existing!.academicYear) : repository.currentAcademicYear(),
    ]);
    return _FormData(results[0]! as List<TeacherRow>, results[1] as String? ?? fallbackAcademicYear(DateTime.now()));
  }

  @override
  void dispose() {
    for (final controller in [_name, _section, _strength, _stream, _medium, _customSubject]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _toggle(String subject) => setState(() {
        final match = _subjects.where((item) => item.toLowerCase() == subject.toLowerCase()).firstOrNull;
        _subjects = match == null ? [..._subjects, subject] : [..._subjects]..remove(match);
      });

  void _addCustom() {
    final value = _customSubject.text.trim();
    if (value.length < 2) return;
    setState(() {
      _subjects = ClassDraft.uniqueSubjects([..._subjects, value]);
      _customSubject.clear();
    });
  }

  Future<void> _save(String academicYear) async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_subjects.isEmpty) {
      setState(() => _error = 'Choose at least one subject.');
      return;
    }

    final draft = ClassDraft(
      name: _name.text,
      section: _section.text,
      academicYear: academicYear,
      classTeacherId: _teacherId!,
      mediumOfInstruction: _medium.text,
      subjects: _subjects,
      maximumStrength: int.tryParse(_strength.text.trim()),
      stream: _stream.text,
    );
    setState(() => _saving = true);
    try {
      final repository = context.read<PrincipalRepository>();
      if (_editing) {
        await repository.updateClass(widget.existing!.id, draft);
      } else {
        await repository.createClass(draft);
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit Class' : 'Add Class / Section')),
      body: FutureBuilder<_FormData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(
              message: error is ApiException ? error.message : 'Could not load teachers.',
              onRetry: () => setState(() {
                _future = _load();
              }),
            );
          }

          final data = snapshot.data!;
          final teachers = data.teachers;
          final teacherIds = {for (final teacher in teachers) teacher.id};
          final suggestions = {...suggestedClassSubjects, ..._subjects}.toList();

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const SectionHeader(title: 'Basic Details'),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _name,
                        decoration: const InputDecoration(labelText: 'Class name *', hintText: 'e.g. 10'),
                        validator: (value) => (value?.trim().isEmpty ?? true) ? 'Required' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _section,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(labelText: 'Section *', hintText: 'e.g. A'),
                        validator: (value) => (value?.trim().isEmpty ?? true) ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                InputDecorator(
                  decoration: InputDecoration(
                    labelText: 'Academic year',
                    helperText: _editing ? null : 'The school’s current academic year',
                    enabled: false,
                  ),
                  child: Text(data.academicYear),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: teacherIds.contains(_teacherId) ? _teacherId : null,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Class teacher *'),
                  items: [for (final teacher in teachers) DropdownMenuItem(value: teacher.id, child: Text(teacher.fullName))],
                  onChanged: (value) => setState(() => _teacherId = value),
                  validator: (value) => value == null
                      ? teachers.isEmpty
                          ? 'Add a teacher first'
                          : 'Choose a class teacher'
                      : null,
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _strength,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Max strength'),
                        validator: (value) {
                          final text = value?.trim() ?? '';
                          if (text.isEmpty) return null;
                          final number = int.tryParse(text);
                          return number == null || number < 1 ? 'Whole number' : null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _medium,
                        decoration: const InputDecoration(labelText: 'Medium *'),
                        validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _stream,
                  decoration: const InputDecoration(labelText: 'Stream', hintText: 'e.g. Science (classes 11–12)'),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    return text.isNotEmpty && text.length < 2 ? 'At least 2 letters' : null;
                  },
                ),
                const SizedBox(height: 20),
                SectionHeader(title: 'Subjects (${_subjects.length})'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final subject in suggestions)
                      FilterChip(
                        label: Text(subject),
                        selected: _subjects.any((item) => item.toLowerCase() == subject.toLowerCase()),
                        onSelected: (_) => _toggle(subject),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _customSubject,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(hintText: 'Add another subject'),
                        onSubmitted: (_) => _addCustom(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      tooltip: 'Add subject',
                      onPressed: _addCustom,
                      icon: const Icon(Icons.add_rounded),
                    ),
                  ],
                ),
                if (_editing) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'A subject that already has exams, homework or timetable periods cannot be removed.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
                    child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _saving ? null : () => _save(data.academicYear),
                  child: Text(_saving ? 'Saving…' : (_editing ? 'Save Changes' : 'Create Class')),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
