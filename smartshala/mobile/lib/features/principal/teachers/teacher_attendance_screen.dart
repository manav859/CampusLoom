import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/list_with_header.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/teacher_models.dart';
import 'teacher_profile_screen.dart';

/// Teacher Attendance: who has punched in on a day, who is on leave, and who
/// is neither. Opens on today, with the teachers not yet in at the top.
class TeacherAttendanceScreen extends StatefulWidget {
  const TeacherAttendanceScreen({super.key, this.today});

  /// Fixed in tests; otherwise the device's date.
  final DateTime? today;

  @override
  State<TeacherAttendanceScreen> createState() => _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends State<TeacherAttendanceScreen> {
  static const _tabs = [null, StaffDayStatus.notPunchedIn, StaffDayStatus.onLeave, StaffDayStatus.present];

  late final DateTime _today = DateUtils.dateOnly(widget.today ?? DateTime.now());
  late DateTime _date = _today;
  late Future<StaffDay> _future = _load();
  int _tabIndex = 0;

  Future<StaffDay> _load() => context.read<PrincipalRepository>().staffDay(_date);

  void _showDate(DateTime date) {
    setState(() {
      _date = date;
      _future = _load();
    });
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.catchError((Object _) => const StaffDay(isSunday: false, present: 0, onLeave: 0, notPunchedIn: 0, staff: []));
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(_today.year - 1),
      lastDate: _today,
    );
    if (picked != null) _showDate(picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Teacher Attendance')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<StaffDay>(
          future: _future,
          builder: (context, snapshot) {
            final dateBar = _DateBar(
              date: _date,
              isToday: _date == _today,
              onPrevious: () => _showDate(_date.subtract(const Duration(days: 1))),
              onNext: _date == _today ? null : () => _showDate(_date.add(const Duration(days: 1))),
              onPick: _pickDate,
            );

            if (snapshot.connectionState == ConnectionState.waiting) {
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [dateBar, const SizedBox(height: 60), const LoadingView(message: 'Loading attendance…')],
              );
            }

            if (snapshot.hasError) {
              final error = snapshot.error;
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  dateBar,
                  const SizedBox(height: 60),
                  ErrorView(
                    message: error is ApiException ? error.message : 'Could not load teacher attendance.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final day = snapshot.data!;
            final filter = _tabs[_tabIndex];
            final rows = filter == null ? day.staff : day.staff.where((row) => row.status == filter).toList();
            final closedNote = day.holiday != null
                ? 'School holiday: ${day.holiday}'
                : day.isSunday
                    ? 'Sunday — the school is closed.'
                    : null;

            return ListWithHeader(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              header: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  dateBar,
                  if (closedNote != null) ...[
                    const SizedBox(height: 12),
                    AppCard(
                      child: Row(
                        children: [
                          const Icon(Icons.beach_access_rounded, size: 20, color: AppColors.warning),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              closedNote,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  ResponsiveGrid(
                    phoneColumns: 3,
                    wideColumns: 3,
                    children: [
                      KpiCard(index: 3, label: 'Present', value: '${day.present}', icon: Icons.how_to_reg_rounded),
                      KpiCard(index: 1, label: 'On Leave', value: '${day.onLeave}', icon: Icons.event_busy_rounded),
                      KpiCard(index: 2, label: 'Not In', value: '${day.notPunchedIn}', icon: Icons.person_off_rounded),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SegmentedTabs(
                    labels: const ['All', 'Not In', 'On Leave', 'Present'],
                    counts: [day.staff.length, day.notPunchedIn, day.onLeave, day.present],
                    index: _tabIndex,
                    onChanged: (index) => setState(() => _tabIndex = index),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
              itemCount: rows.length,
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _StaffRow(
                  row: rows[index],
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => TeacherProfileScreen(teacherId: rows[index].id)),
                  ),
                ),
              ),
              empty: const Padding(
                padding: EdgeInsets.only(top: 40),
                child: EmptyView(icon: Icons.groups_2_rounded, title: 'No teachers here'),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _DateBar extends StatelessWidget {
  const _DateBar({
    required this.date,
    required this.isToday,
    required this.onPrevious,
    required this.onNext,
    required this.onPick,
  });

  final DateTime date;
  final bool isToday;
  final VoidCallback onPrevious;
  final VoidCallback? onNext;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final label = DateFormat('EEE, d MMM yyyy').format(date);

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          IconButton(
            onPressed: onPrevious,
            tooltip: 'Previous day',
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: InkWell(
              onTap: onPick,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  isToday ? 'Today · $label' : label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: onNext,
            tooltip: 'Next day',
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

/// "6h 25m", as the teacher's own punch card shows it.
String _hours(int minutes) => '${minutes ~/ 60}h ${minutes % 60}m';

String staffDayDetail(StaffDayRow row) {
  final time = DateFormat('h:mm a');
  return switch (row.status) {
    StaffDayStatus.notPunchedIn => row.phone,
    StaffDayStatus.onLeave => row.leaveType?.label ?? 'On leave',
    StaffDayStatus.present => [
        'In ${time.format(row.punchInAt!)}',
        row.punchOutAt == null ? 'not punched out' : 'Out ${time.format(row.punchOutAt!)}',
        if (row.workedMinutes != null) _hours(row.workedMinutes!),
      ].join(' · '),
  };
}

class _StaffRow extends StatelessWidget {
  const _StaffRow({required this.row, required this.onTap});

  final StaffDayRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (label, color, tint, icon) = switch (row.status) {
      StaffDayStatus.present => ('Present', AppColors.success, AppColors.successSoft, Icons.how_to_reg_rounded),
      StaffDayStatus.onLeave => ('On Leave', AppColors.warning, AppColors.warningSoft, Icons.event_busy_rounded),
      StaffDayStatus.notPunchedIn => ('Not In', AppColors.danger, AppColors.dangerSoft, Icons.person_off_rounded),
    };

    return ListRowCard(
      icon: icon,
      color: color,
      title: row.fullName,
      subtitle: staffDayDetail(row),
      trailing: StatusChip(label: label, color: color, tint: tint),
      onTap: onTap,
    );
  }
}
