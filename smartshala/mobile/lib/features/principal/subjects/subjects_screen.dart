import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';

/// Subjects, class by class. Subjects belong to a class in SmartShala, so a
/// subject is added to or removed from one class here. The server refuses to
/// remove a subject that exams, homework or the timetable still use, and says so.
class SubjectsScreen extends StatefulWidget {
  const SubjectsScreen({super.key});

  @override
  State<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends State<SubjectsScreen> {
  late Future<List<ClassRow>> _future;
  String _query = '';
  String? _savingClassId;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _future = _repository.classRows();
  }

  Future<void> _reload() async {
    final future = _repository.classRows();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  void _toast(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: isError ? AppColors.danger : AppColors.success));
  }

  Future<void> _save(ClassRow row, List<String> subjects, String success) async {
    setState(() => _savingClassId = row.id);
    try {
      await _repository.updateClassSubjects(row.id, subjects);
      if (!mounted) return;
      _toast(success);
      await _reload();
    } on ApiException catch (error) {
      if (mounted) _toast(error.message, isError: true);
    } finally {
      if (mounted) setState(() => _savingClassId = null);
    }
  }

  Future<void> _add(ClassRow row) async {
    final name = await showDialog<String>(context: context, builder: (_) => _AddSubjectDialog(classLabel: row.label));
    if (name == null || !mounted) return;
    final existing = [for (final subject in row.subjects) subject.name];
    if (existing.any((item) => item.toLowerCase() == name.toLowerCase())) {
      _toast('Class ${row.label} already has $name.', isError: true);
      return;
    }
    await _save(row, [...existing, name], '$name added to Class ${row.label}.');
  }

  Future<void> _remove(ClassRow row, SubjectItem subject) async {
    if (row.subjects.length == 1) {
      _toast('A class needs at least one subject.', isError: true);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Remove ${subject.name}?'),
        content: Text('${subject.name} will no longer be a subject of Class ${row.label}.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _save(
      row,
      [for (final item in row.subjects) if (item.id != subject.id) item.name],
      '${subject.name} removed from Class ${row.label}.',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Subjects')),
      body: FutureBuilder<List<ClassRow>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(message: error is ApiException ? error.message : 'Unable to load subjects.', onRetry: _reload);
          }

          final rows = snapshot.data!;
          final query = _query.trim().toLowerCase();
          final visible = rows
              .where((row) =>
                  query.isEmpty ||
                  row.label.toLowerCase().contains(query) ||
                  row.subjects.any((subject) => subject.name.toLowerCase().contains(query)))
              .toList();
          final distinct = {for (final row in rows) for (final subject in row.subjects) subject.name.toLowerCase()}.length;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                Text(
                  '$distinct subjects across ${rows.length} classes. Subjects belong to each class.',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 10),
                TextField(
                  onChanged: (value) => setState(() => _query = value),
                  decoration: const InputDecoration(
                    hintText: 'Search class or subject',
                    prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
                  ),
                ),
                const SizedBox(height: 12),
                if (visible.isEmpty)
                  AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: EmptyView(
                      icon: Icons.menu_book_outlined,
                      title: rows.isEmpty ? 'No classes yet' : 'Nothing matches',
                      message: rows.isEmpty ? 'Subjects are added with each class.' : null,
                    ),
                  )
                else
                  for (final row in visible) ...[
                    AppCard(
                      padding: const EdgeInsets.fromLTRB(14, 8, 8, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Class ${row.label}',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                ),
                              ),
                              if (_savingClassId == row.id)
                                const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                                )
                              else
                                TextButton.icon(
                                  onPressed: _savingClassId == null ? () => _add(row) : null,
                                  icon: const Icon(Icons.add_rounded, size: 18),
                                  label: const Text('Add'),
                                ),
                            ],
                          ),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final subject in row.subjects)
                                InputChip(
                                  label: Text(subject.name),
                                  onDeleted: _savingClassId == null ? () => _remove(row, subject) : null,
                                  deleteButtonTooltipMessage: 'Remove ${subject.name}',
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
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

class _AddSubjectDialog extends StatefulWidget {
  const _AddSubjectDialog({required this.classLabel});

  final String classLabel;

  @override
  State<_AddSubjectDialog> createState() => _AddSubjectDialogState();
}

class _AddSubjectDialogState extends State<_AddSubjectDialog> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _controller.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'At least 2 letters');
      return;
    }
    Navigator.of(context).pop(name);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Add subject to ${widget.classLabel}'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(labelText: 'Subject name', errorText: _error),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: _submit,
          style: FilledButton.styleFrom(minimumSize: const Size(88, 42)),
          child: const Text('Add'),
        ),
      ],
    );
  }
}
