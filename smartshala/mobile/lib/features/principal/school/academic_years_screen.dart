import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academic_year_models.dart';
import '../data/principal_repository.dart';

/// Academic Years — the list of years with their class counts, and adding a new
/// one. Year-end rollover stays on the web dashboard.
class AcademicYearsScreen extends StatefulWidget {
  const AcademicYearsScreen({super.key});

  @override
  State<AcademicYearsScreen> createState() => _AcademicYearsScreenState();
}

class _AcademicYearsScreenState extends State<AcademicYearsScreen> {
  late Future<List<AcademicYear>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().academicYears();
  }

  Future<void> _refresh() async {
    final future = context.read<PrincipalRepository>().academicYears();
    setState(() => _future = future);
    await future.catchError((Object _) => <AcademicYear>[]);
  }

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _CreateAcademicYearSheet(),
    );
    if (created == true) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Academic Years')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<AcademicYear>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const LoadingView(message: 'Loading academic years…');
            }
            if (snapshot.hasError) {
              return ListView(children: [
                const SizedBox(height: 120),
                ErrorView(
                  message: snapshot.error is ApiException ? (snapshot.error as ApiException).message : 'Could not load academic years.',
                  onRetry: _refresh,
                ),
              ]);
            }

            final years = snapshot.data ?? const <AcademicYear>[];
            if (years.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                EmptyView(
                  icon: Icons.calendar_today_rounded,
                  title: 'No academic years',
                  message: 'Tap "Add Year" to create one.',
                ),
              ]);
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: years.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _YearCard(year: years[index]),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Year'),
      ),
    );
  }
}

class _YearCard extends StatelessWidget {
  const _YearCard({required this.year});

  final AcademicYear year;

  static final _dayFormat = DateFormat('d MMM yyyy');

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text(
                      year.name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    if (year.isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(6)),
                        child: const Text('Current',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                    ],
                  ],
                ),
              ),
              StatusChip(label: year.status.label, color: year.status.color, tint: year.status.tint),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${_dayFormat.format(year.startDate)}  →  ${_dayFormat.format(year.endDate)}',
            style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            '${year.classCount} ${year.classCount == 1 ? 'class' : 'classes'}',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _CreateAcademicYearSheet extends StatefulWidget {
  const _CreateAcademicYearSheet();

  @override
  State<_CreateAcademicYearSheet> createState() => _CreateAcademicYearSheetState();
}

class _CreateAcademicYearSheetState extends State<_CreateAcademicYearSheet> {
  final _name = TextEditingController();
  DateTime? _start;
  DateTime? _end;
  bool _saving = false;
  String? _error;

  static final _dayFormat = DateFormat('d MMM yyyy');

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  /// When the name starts with a year, default the span to Apr 1 → Mar 31,
  /// matching how the web seeds new years.
  void _seedDatesFromName(String value) {
    final match = RegExp(r'^(\d{4})').firstMatch(value.trim());
    if (match == null) return;
    final year = int.parse(match.group(1)!);
    setState(() {
      _start ??= DateTime.utc(year, 4, 1);
      _end ??= DateTime.utc(year + 1, 3, 31);
    });
  }

  Future<void> _pick({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _start : _end) ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 5),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _start = picked;
      } else {
        _end = picked;
      }
    });
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.length < 4) {
      setState(() => _error = 'Name must be like "2026-27".');
      return;
    }
    if (_start == null || _end == null) {
      setState(() => _error = 'Pick a start and end date.');
      return;
    }
    if (!_end!.isAfter(_start!)) {
      setState(() => _error = 'End date must be after the start date.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<PrincipalRepository>().createAcademicYear(name: name, startDate: _start!, endDate: _end!);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New Academic Year', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Name (e.g. 2026-27)'),
            onChanged: _seedDatesFromName,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _dateButton(label: 'Start', value: _start, onTap: () => _pick(isStart: true))),
              const SizedBox(width: 12),
              Expanded(child: _dateButton(label: 'End', value: _end, onTap: () => _pick(isStart: false))),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Text('Create Year'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateButton({required String label, required DateTime? value, required VoidCallback onTap}) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: value == null ? AppColors.textMuted : AppColors.textPrimary,
        side: const BorderSide(color: AppColors.border),
        padding: const EdgeInsets.symmetric(vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(value == null ? 'Set $label' : _dayFormat.format(value), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
    );
  }
}
