import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/calendar_models.dart';
import '../../../core/theme/app_colors.dart';
import '../data/principal_repository.dart';

/// Add or edit an academic calendar event: an exam week, a school event or a
/// meeting, over one day or several. Editing also offers Delete. Pops `true`
/// when the calendar changed. Teachers see the result in their Calendar tab.
class EventFormScreen extends StatefulWidget {
  const EventFormScreen({super.key, this.event, this.initialDate});

  /// The event to edit; null to create one.
  final CalendarEvent? event;

  /// The day a new event starts on, such as the day selected on the grid.
  final DateTime? initialDate;

  @override
  State<EventFormScreen> createState() => _EventFormScreenState();
}

class _EventFormScreenState extends State<EventFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _title = TextEditingController(text: widget.event?.title ?? '');
  late final _description = TextEditingController(text: widget.event?.description ?? '');

  late CalendarEventType _type = widget.event?.type ?? CalendarEventType.event;
  late DateTime _start = _dateOnly(widget.event?.startDate ?? widget.initialDate ?? DateTime.now());
  late DateTime _end = _dateOnly(widget.event?.endDate ?? _start);
  bool _saving = false;
  String? _error;

  static final _format = DateFormat('EEE, d MMM yyyy');

  bool get _editing => widget.event != null;

  static DateTime _dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pick({required bool start}) async {
    final current = start ? _start : _end;
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(current.year - 2),
      lastDate: DateTime(current.year + 2, 12, 31),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        // Moving the start keeps the event's length.
        final length = _end.difference(_start);
        _start = picked;
        _end = picked.add(length);
      } else {
        _end = picked;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_end.isBefore(_start)) {
      setState(() => _error = 'The end date cannot be before the start date.');
      return;
    }

    final draft = CalendarEventDraft(
      type: _type,
      title: _title.text,
      description: _description.text,
      startDate: _start,
      endDate: _end,
    );
    await _run(() {
      final repository = context.read<PrincipalRepository>();
      return _editing ? repository.updateCalendarEvent(widget.event!.id, draft) : repository.createCalendarEvent(draft);
    });
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete event?'),
        content: Text('"${widget.event!.title}" will be removed from the calendar for everyone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(() => context.read<PrincipalRepository>().deleteCalendarEvent(widget.event!.id));
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _saving = true);
    try {
      await action();
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
      appBar: AppBar(
        title: Text(_editing ? 'Edit Event' : 'Add New Event'),
        actions: [
          if (_editing)
            IconButton(
              tooltip: 'Delete event',
              onPressed: _saving ? null : _delete,
              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            const Text('Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final type in CalendarEventDraft.editableTypes)
                  ChoiceChip(
                    label: Text(type.label),
                    avatar: Icon(type.icon, size: 16, color: _type == type ? type.color : AppColors.textMuted),
                    selected: _type == type,
                    selectedColor: type.tint,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _type == type ? type.color : AppColors.textSecondary,
                    ),
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _type = type),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 150,
              decoration: const InputDecoration(labelText: 'Title *', counterText: ''),
              validator: (value) => (value?.trim().length ?? 0) < 3 ? 'Give the event a title' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _DateField(label: 'Starts *', value: _format.format(_start), onTap: () => _pick(start: true))),
                const SizedBox(width: 12),
                Expanded(child: _DateField(label: 'Ends *', value: _format.format(_end), onTap: () => _pick(start: false))),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 3,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Description', counterText: ''),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
                child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : (_editing ? 'Save Changes' : 'Add Event')),
            ),
            const SizedBox(height: 10),
            const Text(
              'Holidays lock attendance, so they are added from Attendance on the web dashboard.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
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
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}
