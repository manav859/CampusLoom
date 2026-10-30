import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/settings_models.dart';

/// Bell Timings — a start and end time for each period of the school day.
class BellTimingsScreen extends StatefulWidget {
  const BellTimingsScreen({super.key});

  @override
  State<BellTimingsScreen> createState() => _BellTimingsScreenState();
}

class _BellTimingsScreenState extends State<BellTimingsScreen> {
  List<PeriodTime> _rows = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final times = await context.read<PrincipalRepository>().periodTimes();
      if (!mounted) return;
      setState(() {
        _rows = times.filledRows;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _pickTime(int index, {required bool isStart}) async {
    final current = isStart ? _rows[index].startTime : _rows[index].endTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: _parse(current) ?? const TimeOfDay(hour: 8, minute: 0),
    );
    if (picked == null) return;
    final value = _format(picked);
    setState(() {
      _rows[index] = isStart ? _rows[index].copyWith(startTime: value) : _rows[index].copyWith(endTime: value);
    });
  }

  Future<void> _save() async {
    // Only periods with both times set are sent; the server rejects a period
    // whose end is not after its start, so guard that here with a clear message.
    final ready = _rows.where((row) => row.isComplete).toList();
    if (ready.isEmpty) {
      _toast('Set a start and end time for at least one period.');
      return;
    }
    for (final row in ready) {
      if (row.endTime!.compareTo(row.startTime!) <= 0) {
        _toast('Period ${row.periodNumber} must end after it starts.');
        return;
      }
    }

    setState(() => _saving = true);
    try {
      final updated = await context.read<PrincipalRepository>().updatePeriodTimes(ready);
      if (!mounted) return;
      setState(() {
        _rows = updated.filledRows;
        _saving = false;
      });
      _toast('Bell timings saved.', success: true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      _toast(error.message);
    }
  }

  void _toast(String message, {bool success = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(backgroundColor: success ? AppColors.success : AppColors.danger, content: Text(message)),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bell Timings')),
      body: _buildBody(),
      bottomNavigationBar: _loading || _error != null
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
                    : const Text('Save Bell Timings'),
              ),
            ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading bell timings…');
    if (_error != null) {
      return ListView(children: [const SizedBox(height: 80), ErrorView(message: _error!, onRetry: _load)]);
    }
    if (_rows.isEmpty) {
      return const EmptyView(
        icon: Icons.schedule_rounded,
        title: 'No periods configured',
        message: 'Set periods per day in School Profile first.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      itemCount: _rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final row = _rows[index];
        return AppCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  '${row.periodNumber}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: _timeButton(label: 'Start', value: row.startTime, onTap: () => _pickTime(index, isStart: true))),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('→', style: TextStyle(color: AppColors.textMuted)),
              ),
              Expanded(child: _timeButton(label: 'End', value: row.endTime, onTap: () => _pickTime(index, isStart: false))),
            ],
          ),
        );
      },
    );
  }

  Widget _timeButton({required String label, required String? value, required VoidCallback onTap}) {
    final set = value != null && value.isNotEmpty;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: set ? AppColors.textPrimary : AppColors.textMuted,
        side: const BorderSide(color: AppColors.border),
        padding: const EdgeInsets.symmetric(vertical: 11),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(set ? '$label  ${_display(value)}' : 'Set $label', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
    );
  }

  static TimeOfDay? _parse(String? value) {
    if (value == null || !value.contains(':')) return null;
    final parts = value.split(':');
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return TimeOfDay(hour: hour, minute: minute);
  }

  static String _format(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  String _display(String value) {
    final time = _parse(value);
    if (time == null) return value;
    return time.format(context);
  }
}
