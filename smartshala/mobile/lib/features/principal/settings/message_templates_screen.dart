import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/communication_templates.dart';

/// Message Templates — edit the English and Hindi text for each parent-message
/// type. Like the web, edits are kept on this device only.
class MessageTemplatesScreen extends StatefulWidget {
  const MessageTemplatesScreen({super.key});

  @override
  State<MessageTemplatesScreen> createState() => _MessageTemplatesScreenState();
}

class _MessageTemplatesScreenState extends State<MessageTemplatesScreen> {
  final _store = CommunicationTemplateStore();
  final _controllers = <String, TextEditingController>{};
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final drafts = await _store.load();
    if (!mounted) return;
    setState(() {
      for (final template in communicationTemplates) {
        final draft = drafts[template.type] ?? (en: template.en, hi: template.hi);
        _controllers['${template.type}-en'] = TextEditingController(text: draft.en);
        _controllers['${template.type}-hi'] = TextEditingController(text: draft.hi);
      }
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final drafts = <String, TemplateDraft>{
      for (final template in communicationTemplates)
        template.type: (
          en: _controllers['${template.type}-en']!.text.trim(),
          hi: _controllers['${template.type}-hi']!.text.trim(),
        ),
    };
    try {
      await _store.save(drafts);
      _toast('Message templates saved on this device.', success: true);
    } catch (_) {
      _toast('Unable to save templates.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reset() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Reset templates?'),
        content: const Text('This restores every template to its default text.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await _store.reset();
    for (final template in communicationTemplates) {
      _controllers['${template.type}-en']?.text = template.en;
      _controllers['${template.type}-hi']?.text = template.hi;
    }
    _toast('Message templates reset.', success: true);
  }

  void _toast(String message, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(backgroundColor: success ? AppColors.success : AppColors.danger, content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Message Templates'),
        actions: [
          if (!_loading) TextButton(onPressed: _reset, child: const Text('Reset')),
        ],
      ),
      body: _loading
          ? const LoadingView(message: 'Loading templates…')
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                const Text(
                  'Edit the English and Hindi text for each parent message. These are kept on this device.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: 14),
                for (final template in communicationTemplates) ...[
                  _TemplateCard(
                    template: template,
                    enController: _controllers['${template.type}-en']!,
                    hiController: _controllers['${template.type}-hi']!,
                  ),
                  const SizedBox(height: 12),
                ],
              ],
            ),
      bottomNavigationBar: _loading
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : const Text('Save Templates'),
              ),
            ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({required this.template, required this.enController, required this.hiController});

  final CommunicationTemplate template;
  final TextEditingController enController;
  final TextEditingController hiController;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(template.label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 2),
          Text(template.description, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 12),
          TextField(
            controller: enController,
            maxLines: null,
            minLines: 2,
            decoration: const InputDecoration(labelText: 'English', alignLabelWithHint: true),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: hiController,
            maxLines: null,
            minLines: 2,
            decoration: const InputDecoration(labelText: 'Hindi', alignLabelWithHint: true),
          ),
        ],
      ),
    );
  }
}
