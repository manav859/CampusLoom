import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/student_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';

/// New Fee Structure: name, amount and a single due date, optionally tied to a
/// class. The server also accepts staged installments, which the web dashboard
/// handles; this form always sends one due date. Pops `true` once saved.
class CreateFeeStructureScreen extends StatefulWidget {
  const CreateFeeStructureScreen({super.key});

  @override
  State<CreateFeeStructureScreen> createState() => _CreateFeeStructureScreenState();
}

class _CreateFeeStructureScreenState extends State<CreateFeeStructureScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _amount = TextEditingController();
  final _academicYear = TextEditingController();

  late Future<List<ClassChoice>> _classes;
  String? _classId;
  String _frequency = 'ANNUAL';
  DateTime? _dueDate;
  bool _saving = false;
  String? _error;

  static const _frequencies = [
    ('ANNUAL', 'Annual'),
    ('BIANNUAL', 'Half-yearly'),
    ('QUARTERLY', 'Quarterly'),
    ('MONTHLY', 'Monthly'),
    ('CUSTOM', 'Custom'),
  ];

  @override
  void initState() {
    super.initState();
    _classes = context.read<PrincipalRepository>().classes();
  }

  @override
  void dispose() {
    for (final controller in [_name, _amount, _academicYear]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_dueDate == null) {
      setState(() => _error = 'Choose a due date.');
      return;
    }

    final due = _dueDate!;
    final academicYear = _academicYear.text.trim();
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'totalAmount': double.parse(_amount.text.trim()),
      'frequency': _frequency,
      'dueDate':
          '${due.year.toString().padLeft(4, '0')}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}',
      if (_classId != null) 'classId': _classId,
      if (academicYear.isNotEmpty) 'academicYear': academicYear,
    };

    setState(() => _saving = true);
    try {
      await context.read<PrincipalRepository>().createFeeStructure(body);
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
      appBar: AppBar(title: const Text('New Fee Structure')),
      body: FutureBuilder<List<ClassChoice>>(
        future: _classes,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snapshot.hasError) {
            return ErrorView(
              message: snapshot.error is ApiException
                  ? (snapshot.error as ApiException).message
                  : 'Could not load classes.',
              onRetry: () => setState(() {
                _classes = context.read<PrincipalRepository>().classes();
              }),
            );
          }

          final classes = snapshot.data!;

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const SectionHeader(title: 'Structure'),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Name *',
                    hintText: 'Term 1 Tuition',
                  ),
                  validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Enter a name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Total amount (₹) *'),
                  validator: (value) {
                    final amount = double.tryParse(value?.trim() ?? '');
                    if (amount == null || amount <= 0) return 'Enter an amount above zero';
                    if (amount > 10000000) return 'Too large';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _frequency,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Frequency'),
                  items: [
                    for (final (value, label) in _frequencies)
                      DropdownMenuItem(value: value, child: Text(label)),
                  ],
                  onChanged: (value) => setState(() => _frequency = value ?? 'ANNUAL'),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _pickDueDate,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Due date *',
                      suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                    ),
                    child: Text(
                      _dueDate == null ? 'Not set' : DateFormat('d MMM yyyy').format(_dueDate!),
                      style: TextStyle(
                        color: _dueDate == null ? AppColors.textMuted : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Applies To'),
                DropdownButtonFormField<String?>(
                  initialValue: _classId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Class',
                    helperText: 'Pick a class to allow one-tap assignment to all its students',
                  ),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('No class (assign per student)')),
                    for (final item in classes)
                      DropdownMenuItem<String?>(value: item.id, child: Text(item.label)),
                  ],
                  onChanged: (value) => setState(() => _classId = value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _academicYear,
                  decoration: const InputDecoration(
                    labelText: 'Academic year',
                    hintText: '2026-27',
                  ),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return null;
                    return text.length < 4 ? 'Use a form like 2026-27' : null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerSoft,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Saving…' : 'Create Structure'),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Staged installments and concessions are set up on the web dashboard.',
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
