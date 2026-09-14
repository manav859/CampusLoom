import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';

/// Edit School Profile: the web Settings form's text fields. The logo and the
/// periods per day are sent back unchanged. Pops `true` once saved; the web
/// dashboard shows the change on its next load.
class EditSchoolProfileScreen extends StatefulWidget {
  const EditSchoolProfileScreen({super.key, required this.profile});

  final SchoolProfile profile;

  @override
  State<EditSchoolProfileScreen> createState() => _EditSchoolProfileScreenState();
}

class _EditSchoolProfileScreenState extends State<EditSchoolProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.profile.name);
  late final _city = TextEditingController(text: widget.profile.city ?? '');
  late final _state = TextEditingController(text: widget.profile.state ?? '');
  late final _phone = TextEditingController(text: widget.profile.phone ?? '');
  late final _udise = TextEditingController(text: widget.profile.udiseNumber ?? '');
  late String _board = widget.profile.affiliationBoard ?? 'CBSE';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_name, _city, _state, _phone, _udise]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    try {
      await context.read<PrincipalRepository>().updateSchoolProfile(
            widget.profile.updateJson(
              name: _name.text,
              city: _city.text,
              state: _state.text,
              phone: _phone.text,
              udiseNumber: _udise.text,
              affiliationBoard: _board,
            ),
          );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // A board typed on the web outside the usual list still shows and saves.
    final boards = {...SchoolProfile.boards, _board}.toList();
    String? maxLength200(String? value) => (value?.trim().length ?? 0) > 200 ? 'Keep it under 200 characters' : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Edit School Profile')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'School name *'),
              validator: (value) {
                final length = value?.trim().length ?? 0;
                if (length < 2) return 'Enter the school’s name';
                return length > 160 ? 'Keep it under 160 characters' : null;
              },
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _city,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'City'),
                    validator: maxLength200,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _state,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'State'),
                    validator: maxLength200,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone'),
              validator: maxLength200,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _udise,
              decoration: const InputDecoration(labelText: 'U-DISE number'),
              validator: maxLength200,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _board,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Affiliation Board'),
              items: [for (final board in boards) DropdownMenuItem(value: board, child: Text(board))],
              onChanged: (value) => setState(() => _board = value ?? _board),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
                child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save profile')),
          ],
        ),
      ),
    );
  }
}
