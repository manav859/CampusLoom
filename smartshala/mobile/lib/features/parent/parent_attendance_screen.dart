import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';
import 'widgets/attendance_bits.dart';

/// A child's attendance: this month's percentage, the present/absent/total
/// counts, and a calendar coloured by how each school day was marked. The month
/// can be stepped back and forth.
class ParentAttendanceScreen extends StatefulWidget {
  const ParentAttendanceScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentAttendanceScreen> createState() => _ParentAttendanceScreenState();
}

class _ParentAttendanceScreenState extends State<ParentAttendanceScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  MonthlyAttendance? _data;
  String? _error;
  bool _loading = true;

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
      final data = await context.read<ParentRepository>().attendance(
            widget.childId,
            month: DateFormat('yyyy-MM').format(_month),
          );
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _step(int months) {
    setState(() => _month = DateTime(_month.year, _month.month + months));
    _load();
  }

  bool get _atCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Attendance'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(widget.childName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _content(_data!),
      ),
    );
  }

  Widget _content(MonthlyAttendance data) {
    final summary = data.summary;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        HomeSurface(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              AttendanceRing(percentage: summary.percentage),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Attendance',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('MMMM yyyy').format(_month),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      summary.totalDays == 0
                          ? 'No school days marked yet'
                          : 'Present ${summary.present} of ${summary.totalDays} days',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: KpiBlock(
                label: 'Present',
                value: '${summary.present}',
                icon: Icons.check_circle_outline_rounded,
                ground: AppColors.successSoft,
                accent: AppColors.success,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KpiBlock(
                label: 'Absent',
                value: '${summary.absent}',
                icon: Icons.cancel_outlined,
                ground: AppColors.dangerSoft,
                accent: AppColors.danger,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KpiBlock(
                label: 'Total Days',
                value: '${summary.totalDays}',
                icon: Icons.event_available_outlined,
                ground: AppColors.primarySoft,
                accent: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        HomeSurface(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
          child: Column(
            children: [
              _MonthHeader(
                month: _month,
                onPrev: () => _step(-1),
                onNext: _atCurrentMonth ? null : () => _step(1),
              ),
              const SizedBox(height: 8),
              _CalendarGrid(month: _month, days: data.daily),
              const SizedBox(height: 14),
              const _Legend(),
            ],
          ),
        ),
      ],
    );
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.month, required this.onPrev, this.onNext});

  final DateTime month;
  final VoidCallback onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(onPressed: onPrev, icon: const Icon(Icons.chevron_left_rounded)),
        Text(
          DateFormat('MMMM yyyy').format(month),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
        ),
        IconButton(
          onPressed: onNext,
          icon: Icon(Icons.chevron_right_rounded, color: onNext == null ? AppColors.border : null),
        ),
      ],
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({required this.month, required this.days});

  final DateTime month;
  final List<AttendanceDay> days;

  @override
  Widget build(BuildContext context) {
    // Status by day-of-month for this month.
    final byDay = <int, AttendanceStatus>{};
    for (final day in days) {
      if (day.date.year == month.year && day.date.month == month.month) {
        byDay[day.date.day] = day.status;
      }
    }

    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Monday-first offset: DateTime.weekday is 1 (Mon)..7 (Sun).
    final leadingBlanks = DateTime(month.year, month.month, 1).weekday - 1;
    final cells = <Widget>[
      for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
      for (var day = 1; day <= daysInMonth; day++) _DayCell(day: day, status: byDay[day]),
    ];

    return Column(
      children: [
        Row(
          children: const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              .map((d) => Expanded(
                    child: Center(
                      child: Text(
                        d,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 6),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: cells,
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.day, this.status});

  final int day;
  final AttendanceStatus? status;

  @override
  Widget build(BuildContext context) {
    final marked = status != null && status != AttendanceStatus.unknown;
    final ground = marked ? attendanceSoft(status!) : Colors.transparent;
    final ink = marked ? attendanceColor(status!) : AppColors.textSecondary;

    return Container(
      decoration: BoxDecoration(
        color: ground,
        borderRadius: BorderRadius.circular(9),
        border: marked ? null : Border.all(color: AppColors.border),
      ),
      alignment: Alignment.center,
      child: Text(
        '$day',
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: marked ? FontWeight.w700 : FontWeight.w500,
          color: ink,
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    Widget chip(AttendanceStatus status) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(color: attendanceColor(status), borderRadius: BorderRadius.circular(4)),
            ),
            const SizedBox(width: 6),
            Text(attendanceLabel(status), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        );

    return Wrap(
      spacing: 18,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        chip(AttendanceStatus.present),
        chip(AttendanceStatus.absent),
        chip(AttendanceStatus.leave),
      ],
    );
  }
}
