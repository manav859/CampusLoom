import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';

/// Sends one parent message. Implemented by each role's repository against
/// POST /communication/messages (targetType STUDENT).
typedef ParentMessageSender = Future<void> Function({
  required String type,
  required String message,
});

/// A CommunicationMessageType the server accepts, with a friendly label.
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

/// Compose a message to one student's parents. On send the server pushes it to
/// the parent app and logs it against the student, so it reappears in the
/// Communication tab after this screen pops `true`. Shared by the teacher and
/// principal apps, which differ only in the [onSend] implementation.
class MessageParentScreen extends StatefulWidget {
  const MessageParentScreen({
    super.key,
    required this.studentName,
    required this.className,
    required this.parentName,
    required this.onSend,
  });

  final String studentName;
  final String className;
  final String? parentName;
  final ParentMessageSender onSend;

  @override
  State<MessageParentScreen> createState() => _MessageParentScreenState();
}

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
      await widget.onSend(type: _type.apiValue, message: _message.text.trim());
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
    final parent = (widget.parentName ?? '').isEmpty ? 'the parents' : widget.parentName!;

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
                          widget.studentName,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'To $parent · Class ${widget.className}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<_MessageType>(
              initialValue: _type,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Message type'),
              items: [
                for (final item in _messageTypes)
                  DropdownMenuItem(value: item, child: Text(item.label)),
              ],
              onChanged: (item) => setState(() => _type = item ?? _messageTypes.first),
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
