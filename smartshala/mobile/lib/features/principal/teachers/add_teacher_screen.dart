import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../data/principal_repository.dart';
import '../data/teacher_models.dart';

/// Add Teacher, or Edit Teacher when [teacher] is given. The fields and rules
/// are the web's: Add takes name, phone, email, initial password and academic
/// background; Edit takes name, phone and email. Pops `true` once saved.
class AddTeacherScreen extends StatefulWidget {
  const AddTeacherScreen({super.key, this.teacher});

  final TeacherRow? teacher;

  @override
  State<AddTeacherScreen> createState() => _AddTeacherScreenState();
}

class _AddTeacherScreenState extends State<AddTeacherScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.teacher?.fullName);
  late final _phone = TextEditingController(text: widget.teacher?.phone);
  late final _email = TextEditingController(text: widget.teacher?.email);
  final _password = TextEditingController();
  final _background = TextEditingController();

  bool _saving = false;
  String? _error;

  bool get _editing => widget.teacher != null;

  @override
  void dispose() {
    for (final controller in [_name, _phone, _email, _password, _background]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    final repository = context.read<PrincipalRepository>();
    try {
      if (_editing) {
        await repository.updateTeacher(widget.teacher!.id, fullName: _name.text, phone: _phone.text, email: _email.text);
      } else {
        await repository.createTeacher(NewTeacher(
          fullName: _name.text,
          phone: _phone.text,
          email: _email.text,
          password: _password.text,
          academicBackground: _background.text,
        ));
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
    final label = _editing ? 'Save Changes' : 'Add Teacher';

    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit Teacher' : 'Add Teacher')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            const SectionHeader(title: 'Basic Details'),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name *'),
              validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Enter the teacher’s full name' : null,
            ),
            if (!_editing) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _background,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Academic background',
                  hintText: 'e.g. M.Sc. Mathematics, B.Ed.',
                ),
              ),
            ],
            const SizedBox(height: 22),
            const SectionHeader(title: 'Contact Details'),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone *'),
              validator: (value) => (value?.trim().length ?? 0) < 10 ? 'Enter at least 10 digits' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (value) {
                final text = value?.trim() ?? '';
                return text.isEmpty || RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text) ? null : 'Enter a valid email';
              },
            ),
            if (!_editing) ...[
              const SizedBox(height: 22),
              const SectionHeader(title: 'Login Details'),
              TextFormField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Initial password *',
                  helperText: 'The teacher signs in with their phone or email and this password.',
                  helperMaxLines: 2,
                ),
                validator: (value) {
                  final length = value?.length ?? 0;
                  return length < 6 || length > 72 ? 'Use 6 to 72 characters' : null;
                },
              ),
            ],
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
              child: Text(_saving ? 'Saving…' : label),
            ),
            if (!_editing) ...[
              const SizedBox(height: 10),
              const Text(
                'Assign classes and periods on the web dashboard Teachers page.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
