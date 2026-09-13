import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';
import '../widgets/picker_field.dart';

class CreateHomeworkScreen extends StatefulWidget {
  const CreateHomeworkScreen({super.key});

  @override
  State<CreateHomeworkScreen> createState() => _CreateHomeworkScreenState();
}

class _CreateHomeworkScreenState extends State<CreateHomeworkScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();

  List<TeachingClass> _classes = const [];
  TeachingClass? _selectedClass;
  SubjectOption? _selectedSubject;
  DateTime _dueDate = DateTime.now().add(const Duration(days: 1));

  bool _loading = true;
  bool _saving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final classes = await context.read<TeacherRepository>().homeworkContext();
      if (!mounted) return;
      setState(() {
        _classes = classes;
        _selectedClass = classes.isNotEmpty ? classes.first : null;
        _selectedSubject = _selectedClass?.subjects.firstOrNull;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final selectedClass = _selectedClass;
    final selectedSubject = _selectedSubject;
    if (selectedClass == null || selectedSubject == null) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Pick a class and subject first.')));
      return;
    }

    setState(() => _saving = true);
    try {
      await context.read<TeacherRepository>().createHomework(
            classId: selectedClass.id,
            subjectId: selectedSubject.id,
            title: _title.text,
            dueDate: _dueDate,
            description: _description.text,
          );
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Homework assigned to Class ${selectedClass.label}.'),
          ),
        );
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Homework')),
      body: _loading
          ? const LoadingView()
          : _loadError != null
              ? ErrorView(message: _loadError!, onRetry: _load)
              : _classes.isEmpty
                  ? const EmptyView(
                      icon: Icons.class_outlined,
                      title: 'No classes assigned',
                      message: 'You need an assigned class before you can set homework.',
                    )
                  : Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        children: [
                          PickerField<TeachingClass>(
                            label: 'Class',
                            value: _selectedClass,
                            items: _classes,
                            labelOf: (item) => item.label,
                            idOf: (item) => item.id,
                            onChanged: (item) => setState(() {
                              _selectedClass = item;
                              _selectedSubject = item.subjects.firstOrNull;
                            }),
                          ),
                          const SizedBox(height: 14),
                          PickerField<SubjectOption>(
                            label: 'Subject',
                            value: _selectedSubject,
                            items: _selectedClass?.subjects ?? const [],
                            labelOf: (item) => item.name,
                            idOf: (item) => item.id,
                            hint: 'No subjects for this class',
                            onChanged: (item) => setState(() => _selectedSubject = item),
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _title,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: const InputDecoration(
                              labelText: 'Title',
                              hintText: 'e.g. Cell Structure Diagram',
                            ),
                            validator: (value) => (value == null || value.trim().length < 2)
                                ? 'Give the homework a title'
                                : null,
                          ),
                          const SizedBox(height: 14),
                          InkWell(
                            onTap: _pickDueDate,
                            borderRadius: BorderRadius.circular(14),
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Due date'),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(DateFormat('d MMM yyyy').format(_dueDate)),
                                  ),
                                  const Icon(Icons.calendar_today_rounded,
                                      size: 16, color: AppColors.textMuted),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _description,
                            maxLines: 4,
                            maxLength: 2000,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: const InputDecoration(
                              labelText: 'Description (optional)',
                              alignLabelWithHint: true,
                            ),
                          ),
                          const SizedBox(height: 8),
                          FilledButton(
                            onPressed: _saving ? null : _submit,
                            child: _saving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Assign Homework'),
                          ),
                        ],
                      ),
                    ),
    );
  }
}
