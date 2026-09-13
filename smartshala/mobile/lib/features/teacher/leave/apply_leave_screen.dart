import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/data/messages_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../widgets/picker_field.dart';

class ApplyLeaveScreen extends StatefulWidget {
  const ApplyLeaveScreen({super.key});

  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();

  LeaveType _type = LeaveType.casual;
  DateTime _fromDate = DateTime.now();
  DateTime _toDate = DateTime.now();
  LeaveAttachment? _attachment;
  bool _saving = false;

  static final _dayFormat = DateFormat('d MMM yyyy');

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  int get _days => _toDate.difference(_fromDate).inDays + 1;

  Future<void> _pickFrom() async {
    final picked = await _pickDate(_fromDate);
    if (picked == null) return;
    setState(() {
      _fromDate = picked;
      // Keep the range valid without making the teacher fix it by hand.
      if (_toDate.isBefore(picked)) _toDate = picked;
    });
  }

  Future<void> _pickTo() async {
    final picked = await _pickDate(_toDate, first: _fromDate);
    if (picked != null) setState(() => _toDate = picked);
  }

  Future<DateTime?> _pickDate(DateTime initial, {DateTime? first}) {
    final now = DateTime.now();
    final lowerBound = first ?? DateTime(now.year, now.month, now.day - 30);
    return showDatePicker(
      context: context,
      initialDate: initial.isBefore(lowerBound) ? lowerBound : initial,
      firstDate: lowerBound,
      lastDate: DateTime(now.year + 1, now.month, now.day),
    );
  }

  Future<void> _pickAttachment() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: LeaveAttachment.allowedExtensions,
      withData: false,
    );

    final file = result?.files.singleOrNull;
    final path = file?.path;
    if (file == null || path == null) return;

    final picked = LeaveAttachment(name: file.name, path: path, sizeBytes: file.size);
    if (!mounted) return;

    // Fail here rather than after a 5 MB upload the server would reject.
    if (picked.isTooLarge) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.danger,
            content: Text('${picked.name} is ${picked.readableSize}. The limit is 5 MB.'),
          ),
        );
      return;
    }

    setState(() => _attachment = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    try {
      await context.read<MessagesRepository>().applyForLeave(
            type: _type,
            fromDate: _fromDate,
            toDate: _toDate,
            reason: _reason.text,
            attachment: _attachment,
          );
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.success,
            content: Text('Leave request submitted for approval.'),
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
      appBar: AppBar(title: const Text('Apply Leave')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            PickerField<LeaveType>(
              label: 'Leave type',
              value: _type,
              items: LeaveType.values,
              labelOf: (item) => item.label,
              idOf: (item) => item.apiValue,
              onChanged: (item) => setState(() => _type = item),
            ),
            const SizedBox(height: 14),
            // Side by side: the two dates are read as one range, not two
            // unrelated fields.
            Row(
              children: [
                Expanded(
                  child: _DateField(
                    label: 'From',
                    value: _dayFormat.format(_fromDate),
                    onTap: _pickFrom,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _DateField(
                    label: 'To',
                    value: _dayFormat.format(_toDate),
                    onTap: _pickTo,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.event_note_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Text(
                    '$_days ${_days == 1 ? 'day' : 'days'} of leave',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _reason,
              maxLines: 5,
              maxLength: 500,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Reason',
                hintText: 'Why do you need this leave?',
                alignLabelWithHint: true,
              ),
              validator: (value) => (value == null || value.trim().length < 5)
                  ? 'Give a reason of at least 5 characters'
                  : null,
            ),
            _AttachmentField(
              attachment: _attachment,
              enabled: !_saving,
              onPick: _pickAttachment,
              onClear: () => setState(() => _attachment = null),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Submit Request'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your principal will be notified. You can track the status under Messages.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

/// Optional supporting document — a medical certificate is the common case.
/// Empty it is a single dashed "Attach" row; filled it becomes a file chip
/// with the size and a remove button.
class _AttachmentField extends StatelessWidget {
  const _AttachmentField({
    required this.attachment,
    required this.enabled,
    required this.onPick,
    required this.onClear,
  });

  final LeaveAttachment? attachment;
  final bool enabled;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final picked = attachment;

    if (picked == null) {
      return InkWell(
        onTap: enabled ? onPick : null,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
            color: AppColors.surface,
          ),
          child: Row(
            children: [
              const Icon(Icons.attach_file_rounded, size: 19, color: AppColors.primary),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Attach a document (optional)',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Text(
                'PDF or image',
                style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary),
        color: AppColors.primarySoft,
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              picked.name.toLowerCase().endsWith('.pdf')
                  ? Icons.picture_as_pdf_rounded
                  : Icons.image_rounded,
              size: 18,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  picked.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  picked.readableSize,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: enabled ? onClear : null,
            icon: const Icon(Icons.close_rounded, size: 19),
            color: AppColors.textSecondary,
            tooltip: 'Remove attachment',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13.5),
              ),
            ),
            const Icon(Icons.calendar_today_rounded, size: 15, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
