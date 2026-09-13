import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/data/messages_repository.dart';
import '../../../core/theme/app_colors.dart';

class CreateAnnouncementScreen extends StatefulWidget {
  const CreateAnnouncementScreen({super.key});

  @override
  State<CreateAnnouncementScreen> createState() => _CreateAnnouncementScreenState();
}

class _CreateAnnouncementScreenState extends State<CreateAnnouncementScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _body = TextEditingController();

  AnnouncementAudience _audience = AnnouncementAudience.all;
  AnnouncementPriority _priority = AnnouncementPriority.normal;
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    try {
      await context.read<MessagesRepository>().createAnnouncement(
            title: _title.text,
            body: _body.text,
            audience: _audience,
            priority: _priority,
          );
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Announcement published.'),
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
      appBar: AppBar(title: const Text('Create Announcement')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            TextFormField(
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Title',
                hintText: 'e.g. Staff meeting on Friday',
              ),
              validator: (value) => (value == null || value.trim().length < 3)
                  ? 'Give the announcement a title'
                  : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _body,
              maxLines: 6,
              maxLength: 4000,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Message',
                alignLabelWithHint: true,
              ),
              validator: (value) => (value == null || value.trim().length < 5)
                  ? 'Write the announcement body'
                  : null,
            ),
            const SizedBox(height: 6),
            const Text(
              'Audience',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            _ChoiceWrap<AnnouncementAudience>(
              values: AnnouncementAudience.values,
              selected: _audience,
              labelOf: (value) => value.label,
              onChanged: (value) => setState(() => _audience = value),
            ),
            const SizedBox(height: 18),
            const Text(
              'Priority',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            _ChoiceWrap<AnnouncementPriority>(
              values: AnnouncementPriority.values,
              selected: _priority,
              labelOf: (value) => value.label,
              colorOf: (value) => value.color,
              onChanged: (value) => setState(() => _priority = value),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Publish Announcement'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Choice pills that wrap onto as many lines as the screen needs, so the
/// options stay readable on a narrow phone instead of being clipped.
class _ChoiceWrap<T> extends StatelessWidget {
  const _ChoiceWrap({
    required this.values,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
    this.colorOf,
  });

  final List<T> values;
  final T selected;
  final String Function(T value) labelOf;
  final Color Function(T value)? colorOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: values.map((value) {
        final isSelected = value == selected;
        final color = colorOf?.call(value) ?? AppColors.primary;

        return Material(
          color: isSelected ? color : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            onTap: () => onChanged(value),
            borderRadius: BorderRadius.circular(20),
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isSelected ? color : AppColors.border),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                child: Text(
                  labelOf(value),
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
