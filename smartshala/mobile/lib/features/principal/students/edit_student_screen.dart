import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../../../core/data/student_models.dart';

/// Edit Student: the same essential fields as Add Student, pre-filled from the
/// student's record. Saves as a partial PATCH, so fee structures, transport and
/// documents set on the web dashboard are left untouched. Pops `true` on save.
class EditStudentScreen extends StatefulWidget {
  const EditStudentScreen({super.key, required this.student});

  final StudentDetail student;

  @override
  State<EditStudentScreen> createState() => _EditStudentScreenState();
}

class _EditStudentScreenState extends State<EditStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _admission;
  late final TextEditingController _roll;
  late final TextEditingController _parentName;
  late final TextEditingController _parentPhone;
  late final TextEditingController _address;

  late Future<List<ClassChoice>> _classes;
  String? _classId;
  String? _gender;
  DateTime? _dateOfBirth;
  bool _saving = false;
  String? _error;

  static const _genders = [('MALE', 'Male'), ('FEMALE', 'Female'), ('OTHER', 'Other')];

  @override
  void initState() {
    super.initState();
    final student = widget.student;
    _name = TextEditingController(text: student.fullName);
    _admission = TextEditingController(text: student.admissionNumber);
    _roll = TextEditingController(text: student.rollNumber?.toString() ?? '');
    _parentName = TextEditingController(text: student.parentName);
    _parentPhone = TextEditingController(text: student.parentPhone);
    _address = TextEditingController(text: student.address ?? '');
    _classId = student.classId;
    _gender = student.gender;
    _dateOfBirth = student.dateOfBirth;
    _classes = context.read<PrincipalRepository>().classes();
  }

  @override
  void dispose() {
    for (final controller in [_name, _admission, _roll, _parentName, _parentPhone, _address]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 10, now.month, now.day),
      firstDate: DateTime(now.year - 25),
      lastDate: now,
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final roll = int.tryParse(_roll.text.trim());
    final dob = _dateOfBirth;
    final address = _address.text.trim();
    final admission = _admission.text.trim();

    final body = <String, dynamic>{
      'fullName': _name.text.trim(),
      'classId': _classId,
      'parentName': _parentName.text.trim(),
      'parentPhone': _parentPhone.text.trim(),
      if (admission.isNotEmpty) 'admissionNumber': admission,
      if (roll != null) 'rollNumber': roll,
      if (_gender != null) 'gender': _gender,
      if (dob != null)
        'dateOfBirth':
            '${dob.year.toString().padLeft(4, '0')}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}',
      if (address.isNotEmpty) 'address': address,
    };

    setState(() => _saving = true);
    try {
      await context.read<PrincipalRepository>().updateStudent(widget.student.id, body);
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
      appBar: AppBar(title: const Text('Edit Student')),
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
          // Keep the pre-selected class only if it is still in the list.
          final hasClass = classes.any((item) => item.id == _classId);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const SectionHeader(title: 'Student'),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Full name *'),
                  validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Enter the student’s full name' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: hasClass ? _classId : null,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Class *'),
                  items: [
                    for (final item in classes) DropdownMenuItem(value: item.id, child: Text(item.label)),
                  ],
                  onChanged: (value) => setState(() => _classId = value),
                  validator: (value) => value == null ? 'Choose a class' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _admission,
                        decoration: const InputDecoration(labelText: 'Admission no'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _roll,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Roll no'),
                        validator: (value) {
                          final text = value?.trim() ?? '';
                          if (text.isEmpty) return null;
                          final number = int.tryParse(text);
                          return number == null || number < 1 ? 'Whole number' : null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Gender *'),
                  items: [
                    for (final (value, label) in _genders) DropdownMenuItem(value: value, child: Text(label)),
                  ],
                  onChanged: (value) => setState(() => _gender = value),
                  validator: (value) => value == null ? 'Choose a gender' : null,
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _pickDateOfBirth,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Date of birth',
                      suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                    ),
                    child: Text(
                      _dateOfBirth == null ? 'Not set' : DateFormat('d MMM yyyy').format(_dateOfBirth!),
                      style: TextStyle(
                        color: _dateOfBirth == null ? AppColors.textMuted : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Parent / Guardian'),
                TextFormField(
                  controller: _parentName,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Parent name *'),
                  validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Enter the parent’s name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _parentPhone,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  decoration: const InputDecoration(labelText: 'Parent phone *', counterText: ''),
                  validator: (value) =>
                      RegExp(r'^\d{10}$').hasMatch(value?.trim() ?? '') ? null : 'Enter a 10-digit phone number',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _address,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Address'),
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
                  child: Text(_saving ? 'Saving…' : 'Save Changes'),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Father, mother, fee structure, transport and documents are managed on the web dashboard.',
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
