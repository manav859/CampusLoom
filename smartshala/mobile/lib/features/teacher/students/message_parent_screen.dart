import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';
import '../widgets/picker_field.dart';

/// Compose a message to one student's parents. On send the server pushes it to
/// the parent app and logs it against the student, so it reappears in the
/// Communication tab after this screen pops `true`.
class MessageParentScreen extends StatefulWidget {
  const MessageParentScreen({super.key, required this.student});

  final StudentProfile student;

  @override
  State<MessageParentScreen> createState() => _MessageParentScreenState();
}

/// A CommunicationMessageType the server accepts, with a teacher-friendly label.
class _MessageType {
  const _MessageType(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

const _messageTypes = <_MessageType>[
  _MessageType('GENERIC_NOTICE', 'General notice'),
  _MessageType('HOMEWORK_REMINDER', 'Homework reminder'),
  _MessageType('ATTENDANCE_ALERT', 'Attendance alert'),
  _MessageType('ABSENCE_NOTIFICATION', 'Absence notification'),
  _MessageType('EXAM_ANNOUNCEMENT', 'Exam announcement'),
  _MessageType('PTM_INVITE', 'PTM invite'),
  _MessageType('CUSTOM', 'Custom message'),
];

class _MessageParentScreenState extends State<MessageParentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _message = TextEditingController();

  _MessageType _type = _messageTypes.first;
  bool _sending = false;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _sending = true);
    try {
      await context.read<TeacherRepository>().sendParentMessage(
            studentId: widget.student.id,
            type: _type.apiValue,
            message: _message.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Message sent to the parent app.'),
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
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = widget.student;
    final parent = (student.parentName ?? '').isEmpty ? 'the parents' : student.parentName!;

    return Scaffold(
      appBar: AppBar(title: const Text('Message parent')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.person_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          student.fullName,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'To $parent · Class ${student.className}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PickerField<_MessageType>(
              label: 'Message type',
              value: _type,
              items: _messageTypes,
              labelOf: (item) => item.label,
              idOf: (item) => item.apiValue,
              onChanged: (item) => setState(() => _type = item),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _message,
              maxLines: 6,
              maxLength: 1600,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Message',
                hintText: 'Write the message the parents will receive…',
                alignLabelWithHint: true,
              ),
              validator: (value) => (value == null || value.trim().length < 3)
                  ? 'Write a message of at least 3 characters'
                  : null,
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _sending ? null : _submit,
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Send message'),
            ),
            const SizedBox(height: 12),
            const Text(
              'The parents get this in their app as a notification. A WhatsApp copy is sent to the number on file.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
