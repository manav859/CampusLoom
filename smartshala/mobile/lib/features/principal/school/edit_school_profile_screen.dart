import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';

/// Edit School Profile: the web Settings form — text fields, the school logo,
/// and periods per day. Pops `true` once saved; the web dashboard shows the
/// change on its next load.
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
  late int _periodCount = widget.profile.timetablePeriodCount;
  late String? _logoUrl = widget.profile.logoUrl;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_name, _city, _state, _phone, _udise]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickLogo() async {
    try {
      // Downscale and compress on pick, mirroring the web's 256px JPEG so the
      // data URL stays small enough for the profile PATCH.
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 256,
        maxHeight: 256,
        imageQuality: 80,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final mime = file.mimeType ?? 'image/jpeg';
      setState(() => _logoUrl = 'data:$mime;base64,${base64Encode(bytes)}');
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to read that image.');
    }
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
              timetablePeriodCount: _periodCount,
              logoUrl: _logoUrl,
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
            _LogoField(logoUrl: _logoUrl, onChange: _pickLogo, onRemove: () => setState(() => _logoUrl = null)),
            const SizedBox(height: 18),
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
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              initialValue: _periodCount,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Periods per day',
                helperText: 'Number of timetable periods and bell slots',
              ),
              items: [for (var n = 1; n <= 12; n++) DropdownMenuItem(value: n, child: Text('$n'))],
              onChanged: (value) => setState(() => _periodCount = value ?? _periodCount),
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

/// The logo preview with Change / Remove actions. Shows a data-URL or network
/// logo, falling back to a placeholder when none is set.
class _LogoField extends StatelessWidget {
  const _LogoField({required this.logoUrl, required this.onChange, required this.onRemove});

  final String? logoUrl;
  final VoidCallback onChange;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final hasLogo = logoUrl != null && logoUrl!.isNotEmpty;
    return Row(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: hasLogo
              ? _logoImage(logoUrl!)
              : const Icon(Icons.apartment_rounded, color: AppColors.primary, size: 30),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('School logo', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: onChange,
                    icon: const Icon(Icons.upload_rounded, size: 16),
                    label: Text(hasLogo ? 'Change' : 'Upload'),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                  ),
                  if (hasLogo) ...[
                    const SizedBox(width: 8),
                    TextButton(onPressed: onRemove, child: const Text('Remove', style: TextStyle(color: AppColors.danger))),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _logoImage(String url) {
    if (url.startsWith('data:')) {
      final comma = url.indexOf(',');
      if (comma == -1) return const SizedBox.shrink();
      try {
        return Image.memory(base64Decode(url.substring(comma + 1)), fit: BoxFit.cover);
      } catch (_) {
        return const Icon(Icons.broken_image_rounded, color: AppColors.textMuted);
      }
    }
    return Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_rounded, color: AppColors.textMuted));
  }
}
