import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart' show formatInr;
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/payroll_models.dart';
import '../data/principal_repository.dart';

/// Whole rupees unless there are paise, as on the teacher's Pay Slip.
String _rupees(double value) => formatInr(value, compact: false, fractionDigits: value == value.roundToDouble() ? 0 : 2);

/// Payroll from attendance. Each staff member has a monthly salary and a shift;
/// their punches are measured against the shift day by day, and the month's pay
/// follows. "Generate pay slips" writes it into the slips teachers see as their
/// Pay Slip.
class PayrollScreen extends StatelessWidget {
  const PayrollScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Payroll'),
          bottom: const TabBar(
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: AppColors.primary,
            tabs: [Tab(text: 'Salaries'), Tab(text: 'Shifts')],
          ),
        ),
        body: const TabBarView(children: [_SalariesTab(), _ShiftsTab()]),
      ),
    );
  }
}

// --- Salaries -------------------------------------------------------------------

class _SalariesTab extends StatefulWidget {
  const _SalariesTab();

  @override
  State<_SalariesTab> createState() => _SalariesTabState();
}

class _SalariesTabState extends State<_SalariesTab> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  late Future<PayrollMonth> _future = _load();
  bool _generating = false;

  String get _monthKey => DateFormat('yyyy-MM').format(_month);

  Future<PayrollMonth> _load() => context.read<PrincipalRepository>().payrollMonth(_monthKey);

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.catchError((Object _) => const PayrollMonth(month: '', workingDays: 0, fullDayShare: 0.75, rows: [], totalCalculated: 0));
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _future = _load();
    });
  }

  Future<void> _generate() async {
    final monthLabel = DateFormat('MMMM yyyy').format(_month);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Generate pay slips for $monthLabel?'),
        content: const Text(
          'Each slip gets the monthly salary as basic pay and the attendance cut as the deduction. '
          'Slips already marked paid are not changed.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Generate')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _generating = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final result = await context.read<PrincipalRepository>().generatePayslips(_monthKey);
      final notes = [
        '${result.generated} pay slip${result.generated == 1 ? '' : 's'} ready',
        if (result.skippedPaid > 0) '${result.skippedPaid} already paid',
        if (result.skippedNoSalary > 0) '${result.skippedNoSalary} without a salary',
      ];
      messenger.showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(notes.join(' • '))));
      await _reload();
    } on ApiException catch (error) {
      messenger.showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _editPay(PayrollRow row) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PayProfileSheet(row: row, repository: context.read<PrincipalRepository>()),
    );
    if (saved == true) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureBuilder<PayrollMonth>(
        future: _future,
        builder: (context, snapshot) {
          final header = _MonthSwitcher(
            label: DateFormat('MMMM yyyy').format(_month),
            onPrevious: () => _shiftMonth(-1),
            onNext: () => _shiftMonth(1),
          );

          if (snapshot.connectionState == ConnectionState.waiting) {
            return ListView(children: [header, const SizedBox(height: 120), const LoadingView(message: 'Working out pay…')]);
          }
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ListView(
              children: [
                header,
                const SizedBox(height: 80),
                ErrorView(message: error is ApiException ? error.message : 'Could not load payroll.', onRetry: _reload),
              ],
            );
          }

          final data = snapshot.data!;
          final withSalary = data.rows.where((row) => row.monthlySalary != null).length;
          return ListView(
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              header,
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _Summary(data: data, withSalary: withSalary),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: FilledButton.icon(
                  onPressed: _generating || withSalary == 0 ? null : _generate,
                  icon: _generating
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.receipt_long_rounded, size: 18),
                  label: Text('Generate pay slips for ${DateFormat('MMMM').format(_month)}'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                ),
              ),
              const Padding(padding: EdgeInsets.fromLTRB(16, 18, 16, 0), child: SectionHeader(title: 'Staff')),
              if (data.rows.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: EmptyView(icon: Icons.groups_2_rounded, title: 'No staff yet', message: 'Add teachers to set up their pay.'),
                ),
              for (final row in data.rows)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: _StaffPayCard(row: row, onTap: row.canEdit ? () => _editPay(row) : null),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _MonthSwitcher extends StatelessWidget {
  const _MonthSwitcher({required this.label, required this.onPrevious, required this.onNext});

  final String label;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      child: Row(
        children: [
          IconButton(onPressed: onPrevious, tooltip: 'Previous month', icon: const Icon(Icons.chevron_left_rounded)),
          Expanded(
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
          ),
          IconButton(onPressed: onNext, tooltip: 'Next month', icon: const Icon(Icons.chevron_right_rounded)),
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.data, required this.withSalary});

  final PayrollMonth data;
  final int withSalary;

  @override
  Widget build(BuildContext context) {
    final share = (data.fullDayShare * 100).round();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: _Figure(label: 'Total pay', value: _rupees(data.totalCalculated))),
              Expanded(child: _Figure(label: 'Working days', value: '${data.workingDays}')),
              Expanded(child: _Figure(label: 'Salaries set', value: '$withSalary of ${data.rows.length}')),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'A day is full when punched time reaches $share% of the shift, half below that. '
            'Paid leave counts in full; absent and unpaid-leave days are cut at salary ÷ ${data.workingDays} working days. '
            'Days still ahead are not cut.',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
        const SizedBox(height: 3),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        ),
      ],
    );
  }
}

class _StaffPayCard extends StatelessWidget {
  const _StaffPayCard({required this.row, this.onTap});

  final PayrollRow row;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final days = row.days;
    final (slipLabel, slipColor, slipTint) = switch (row.slip) {
      PayslipState.paid => ('Paid', AppColors.success, AppColors.successSoft),
      PayslipState.pending => ('Slip pending', AppColors.warning, AppColors.warningSoft),
      PayslipState.none => ('No slip', AppColors.textSecondary, AppColors.background),
    };

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(row.fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    const SizedBox(height: 2),
                    Text(
                      row.shift == null ? '${row.roleLabel} • No shift' : '${row.roleLabel} • ${row.shift!.name}, ${row.shift!.timeLabel}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              StatusChip(label: slipLabel, color: slipColor, tint: slipTint),
            ],
          ),
          const SizedBox(height: 12),
          if (row.monthlySalary == null)
            Text(
              row.canEdit ? 'No salary set — tap to set one.' : 'Your own pay is set by another admin.',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.warning),
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Pay this month', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                      Text(
                        _rupees(row.calculatedPay ?? 0),
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ),
                Text(
                  'of ${_rupees(row.monthlySalary!)}',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _DayChip('${days.full} full', AppColors.success, AppColors.successSoft),
                if (days.half > 0) _DayChip('${days.half} half', AppColors.warning, AppColors.warningSoft),
                if (days.leave > 0) _DayChip('${days.leave} leave', AppColors.primary, AppColors.primarySoft),
                if (days.unpaidLeave > 0) _DayChip('${days.unpaidLeave} unpaid leave', AppColors.danger, AppColors.dangerSoft),
                if (days.absent > 0) _DayChip('${days.absent} absent', AppColors.danger, AppColors.dangerSoft),
                if (days.beforeJoining > 0) _DayChip('${days.beforeJoining} before joining', AppColors.textSecondary, AppColors.background),
                if (days.upcoming > 0) _DayChip('${days.upcoming} to come', AppColors.textSecondary, AppColors.background),
              ],
            ),
            if (days.missingPunchOut > 0) ...[
              const SizedBox(height: 8),
              Text(
                '${days.missingPunchOut} day${days.missingPunchOut == 1 ? '' : 's'} without a punch-out, counted in full.',
                style: const TextStyle(fontSize: 12, color: AppColors.warning, fontWeight: FontWeight.w600),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip(this.label, this.color, this.tint);

  final String label;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

/// Salary and shift for one staff member.
class _PayProfileSheet extends StatefulWidget {
  const _PayProfileSheet({required this.row, required this.repository});

  final PayrollRow row;
  final PrincipalRepository repository;

  @override
  State<_PayProfileSheet> createState() => _PayProfileSheetState();
}

class _PayProfileSheetState extends State<_PayProfileSheet> {
  late final _salary = TextEditingController(
    text: widget.row.monthlySalary == null
        ? ''
        : (widget.row.monthlySalary! == widget.row.monthlySalary!.roundToDouble()
            ? widget.row.monthlySalary!.toStringAsFixed(0)
            : widget.row.monthlySalary!.toStringAsFixed(2)),
  );
  late String? _shiftId = widget.row.shift?.id;
  late final Future<List<StaffShift>> _shifts = widget.repository.shifts();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _salary.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final salary = double.tryParse(_salary.text.trim().replaceAll(',', ''));
    if (salary == null || salary < 0) {
      setState(() => _error = 'Enter the monthly salary in rupees.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.savePayProfile(widget.row.userId, monthlySalary: salary, shiftId: _shiftId);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Pay for ${widget.row.fullName}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          TextField(
            controller: _salary,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Monthly salary (₹) *', prefixText: '₹ '),
          ),
          const SizedBox(height: 12),
          FutureBuilder<List<StaffShift>>(
            future: _shifts,
            builder: (context, snapshot) {
              final shifts = snapshot.data ?? const <StaffShift>[];
              return DropdownButtonFormField<String?>(
                isExpanded: true,
                initialValue: shifts.any((shift) => shift.id == _shiftId) ? _shiftId : null,
                decoration: InputDecoration(
                  labelText: 'Shift',
                  helperText: shifts.isEmpty && snapshot.connectionState == ConnectionState.done
                      ? 'No shifts yet — add them in the Shifts tab. Without one, any punch is a full day.'
                      : 'Days are measured against this shift.',
                  helperMaxLines: 2,
                ),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('No shift — any punch is a full day', overflow: TextOverflow.ellipsis),
                  ),
                  for (final shift in shifts)
                    DropdownMenuItem<String?>(
                      value: shift.id,
                      child: Text('${shift.name} (${shift.timeLabel})', overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (value) => setState(() => _shiftId = value),
              );
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
            child: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ],
      ),
    );
  }
}

// --- Shifts ---------------------------------------------------------------------

class _ShiftsTab extends StatefulWidget {
  const _ShiftsTab();

  @override
  State<_ShiftsTab> createState() => _ShiftsTabState();
}

class _ShiftsTabState extends State<_ShiftsTab> {
  late Future<List<StaffShift>> _future = context.read<PrincipalRepository>().shifts();

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().shifts();
    setState(() {
      _future = future;
    });
    await future.catchError((Object _) => const <StaffShift>[]);
  }

  Future<void> _edit([StaffShift? shift]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _ShiftDialog(shift: shift, repository: context.read<PrincipalRepository>()),
    );
    if (saved == true) await _reload();
  }

  Future<void> _delete(StaffShift shift) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Delete ${shift.name}?'),
        content: Text(
          shift.staffCount == 0
              ? 'No one is on this shift.'
              : '${shift.staffCount} staff keep their salary; their days count in full on any punch until you give them another shift.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<PrincipalRepository>().deleteShift(shift.id);
      await _reload();
    } on ApiException catch (error) {
      messenger.showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureBuilder<List<StaffShift>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView(message: 'Loading shifts…');
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ListView(children: [
              const SizedBox(height: 120),
              ErrorView(message: error is ApiException ? error.message : 'Could not load shifts.', onRetry: _reload),
            ]);
          }
          final shifts = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              FilledButton.icon(
                onPressed: () => _edit(),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Shift'),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
              ),
              const SizedBox(height: 16),
              if (shifts.isEmpty)
                const EmptyView(
                  icon: Icons.schedule_rounded,
                  title: 'No shifts yet',
                  message: 'Add the school day, e.g. "Morning, 8:00 AM – 2:00 PM", then give each teacher a shift and salary in Salaries.',
                ),
              for (final shift in shifts)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    onTap: () => _edit(shift),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                          child: const Icon(Icons.schedule_rounded, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(shift.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(
                                '${shift.timeLabel} • ${shift.lengthLabel} • ${shift.staffCount} staff',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Delete shift',
                          onPressed: () => _delete(shift),
                          icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ShiftDialog extends StatefulWidget {
  const _ShiftDialog({required this.repository, this.shift});

  final PrincipalRepository repository;
  final StaffShift? shift;

  @override
  State<_ShiftDialog> createState() => _ShiftDialogState();
}

class _ShiftDialogState extends State<_ShiftDialog> {
  late final _name = TextEditingController(text: widget.shift?.name ?? '');
  late TimeOfDay _start = _parse(widget.shift?.startTime) ?? const TimeOfDay(hour: 8, minute: 0);
  late TimeOfDay _end = _parse(widget.shift?.endTime) ?? const TimeOfDay(hour: 14, minute: 0);
  bool _saving = false;
  String? _error;

  static TimeOfDay? _parse(String? value) {
    final parts = value?.split(':');
    if (parts == null || parts.length != 2) return null;
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final picked = await showTimePicker(context: context, initialTime: start ? _start : _end);
    if (picked != null) setState(() => start ? _start = picked : _end = picked);
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Name the shift.');
      return;
    }
    if (_start == _end) {
      setState(() => _error = 'Start and end must differ.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final draft = ShiftDraft(name: _name.text, start: _start, end: _end);
    try {
      final existing = widget.shift;
      if (existing == null) {
        await widget.repository.createShift(draft);
      } else {
        await widget.repository.updateShift(existing.id, draft);
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
    return AlertDialog(
      title: Text(widget.shift == null ? 'Add Shift' : 'Edit Shift'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            autofocus: widget.shift == null,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Name *', hintText: 'Morning'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _TimeButton(label: 'Starts', value: _start.format(context), onTap: () => _pick(true))),
              const SizedBox(width: 10),
              Expanded(child: _TimeButton(label: 'Ends', value: _end.format(context), onTap: () => _pick(false))),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save')),
      ],
    );
  }
}

class _TimeButton extends StatelessWidget {
  const _TimeButton({required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InputDecorator(decoration: InputDecoration(labelText: label), child: Text(value)),
    );
  }
}
