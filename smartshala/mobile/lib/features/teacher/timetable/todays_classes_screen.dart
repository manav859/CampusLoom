import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/data/timetable_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../attendance/mark_attendance_screen.dart';
import '../data/teacher_models.dart';
import '../data/teacher_repository.dart';

/// The day laid out period by period: what has been taught, what is running
/// now and what is still to come, with the class and its strength on each row.
///
/// It reads the week (GET /users/me/schedule/week) rather than today alone, so
/// moving between days costs no further request, and GET /classes for the roll
/// counts and for whose class each one is.
class TodaysClassesScreen extends StatefulWidget {
  const TodaysClassesScreen({super.key});

  @override
  State<TodaysClassesScreen> createState() => _TodaysClassesScreenState();
}

/// Where a period stands against the clock. A period the principal has set no
/// bell time for has no status at all.
enum PeriodStanding { completed, inClass, upcoming }

class _TodaysClassesScreenState extends State<TodaysClassesScreen> {
  late Future<_Day> _future;
  Timer? _ticker;

  /// Null until the week arrives, then the weekday being shown.
  int? _index;

  @override
  void initState() {
    super.initState();
    _future = _load();
    // "In Class" moves with the clock, like the schedule list on Home.
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<_Day> _load() async {
    final repository = context.read<TeacherRepository>();
    final results = await Future.wait([
      repository.weekTimetable(),
      // Every class the teacher is tied to, class teacher or not.
      repository.myClasses(),
    ]);
    return _Day(
      week: results[0] as WeekTimetable,
      classes: {for (final option in results[1] as List<ClassOption>) option.id: option},
    );
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.catchError((Object _) => _Day.empty);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Today's Classes")),
      body: FutureBuilder<_Day>(
        future: _future,
        builder: (context, snapshot) {
          final data = snapshot.data;
          final error = snapshot.error;
          if (snapshot.connectionState == ConnectionState.waiting && data == null) {
            return const LoadingView(message: 'Loading your day…');
          }
          if (data == null) {
            return ErrorView(
              message: error is ApiException ? error.message : 'Could not load your classes.',
              onRetry: _refresh,
            );
          }

          final now = DateTime.now();
          final days = data.week.days;
          if (days.isEmpty) {
            return const EmptyView(
              icon: Icons.event_busy_rounded,
              title: 'No timetable yet',
              message: 'Your school has not set up the timetable.',
            );
          }

          final index = (_index ?? data.week.indexOfToday(now)).clamp(0, days.length - 1);
          final day = days[index];
          final date = timetableDateOf(index, now);
          final statuses = [for (final slot in day.periods) periodStanding(slot, date, now)];

          final rows = <Widget>[];
          for (var position = 0; position < day.periods.length; position++) {
            final slot = day.periods[position];
            final option = data.classes[slot.classId];
            if (rows.isNotEmpty) rows.add(const SizedBox(height: 10));
            rows.add(
              _ClassRow(
                slot: slot,
                status: statuses[position],
                option: option,
                // Attendance is the class teacher's to mark, and it is today's
                // register the marking screen opens on.
                onMark: _canMark(option, date, now) ? () => _openMarking(slot.classId!) : null,
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _DayPicker(
                  date: date,
                  onTap: () => _pickDay(days, index, now),
                ),
                const SizedBox(height: 16),
                _Summary(total: day.periods.length, statuses: statuses),
                const SizedBox(height: 16),
                if (day.periods.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: EmptyView(
                      icon: Icons.event_busy_rounded,
                      title: 'No classes scheduled',
                      message: 'You have no periods assigned on ${day.label}.',
                    ),
                  )
                else
                  ...rows,
              ],
            ),
          );
        },
      ),
    );
  }

  void _openMarking(String classId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => MarkAttendanceScreen(initialClassId: classId)),
    );
  }

  /// Only the class teacher may mark a class, and only when the day being
  /// shown is today — the marking screen opens on today's date.
  bool _canMark(ClassOption? option, DateTime date, DateTime now) {
    if (option == null || !DateUtils.isSameDay(date, now)) return false;
    final me = context.read<AuthController>().user;
    return me != null && option.classTeacherId == me.id;
  }

  Future<void> _pickDay(List<TimetableDay> days, int current, DateTime now) async {
    final picked = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
      ),
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            for (var position = 0; position < days.length; position++)
              ListTile(
                leading: Icon(
                  position == current ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                  color: position == current ? AppColors.primary : AppColors.textMuted,
                ),
                title: Text(
                  timetableDateLabel(timetableDateOf(position, now)),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: position == current ? FontWeight.w700 : FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
                subtitle: Text('${days[position].taughtPeriods} classes'),
                onTap: () => Navigator.of(sheetContext).pop(position),
              ),
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => _index = picked);
  }
}

/// The date the weekday at [index] falls on. The timetable runs Monday to
/// Saturday; on a Sunday nothing is taught, so the week ahead is the one that
/// matters and the picker opens on it.
DateTime timetableDateOf(int index, DateTime now) {
  final base = now.weekday == DateTime.sunday ? now.add(const Duration(days: 1)) : now;
  final monday = DateUtils.dateOnly(base).subtract(Duration(days: base.weekday - 1));
  return monday.add(Duration(days: index));
}

String timetableDateLabel(DateTime date) => DateFormat('EEEE, d MMMM yyyy').format(date);

/// A period's standing. Another day is wholly past or wholly ahead; today is
/// read off the clock, and a period with no bell time cannot be placed at all.
PeriodStanding? periodStanding(TimetableSlot slot, DateTime date, DateTime now) {
  if (!DateUtils.isSameDay(date, now)) {
    return date.isBefore(DateUtils.dateOnly(now)) ? PeriodStanding.completed : PeriodStanding.upcoming;
  }
  final start = slot.startMinute;
  final end = slot.endMinute;
  if (start == null || end == null) return null;
  final minute = now.hour * 60 + now.minute;
  if (minute >= end) return PeriodStanding.completed;
  return minute >= start ? PeriodStanding.inClass : PeriodStanding.upcoming;
}

/// The week, and the classes it refers to by id.
class _Day {
  const _Day({required this.week, required this.classes});

  final WeekTimetable week;
  final Map<String, ClassOption> classes;

  static const empty = _Day(week: WeekTimetable(days: []), classes: {});
}

class _DayPicker extends StatelessWidget {
  const _DayPicker({required this.date, required this.onTap});

  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        children: [
          const Icon(Icons.calendar_month_rounded, size: 22, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              timetableDateLabel(date),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const Icon(Icons.expand_more_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

/// Four counts across the top: the day's size, and how it is going.
class _Summary extends StatelessWidget {
  const _Summary({required this.total, required this.statuses});

  final int total;
  final List<PeriodStanding?> statuses;

  int _count(PeriodStanding status) => statuses.where((item) => item == status).length;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      (label: 'Classes Today', value: total, color: AppColors.primary, ground: AppColors.primarySoft),
      (label: 'Completed', value: _count(PeriodStanding.completed), color: AppColors.success, ground: AppColors.successSoft),
      (label: 'Upcoming', value: _count(PeriodStanding.upcoming), color: AppColors.warning, ground: AppColors.warningSoft),
      (label: 'In Class', value: _count(PeriodStanding.inClass), color: AppColors.teal, ground: AppColors.tealSoft),
    ];

    return ResponsiveGrid(
      phoneColumns: 4,
      wideColumns: 4,
      spacing: 10,
      children: [
        for (final tile in tiles)
          _SummaryTile(label: tile.label, value: tile.value, color: tile.color, ground: tile.ground),
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.color,
    required this.ground,
  });

  final String label;
  final int value;
  final Color color;
  final Color ground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(color: ground, borderRadius: BorderRadius.circular(AppRadii.card)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$value',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color, height: 1.1),
          ),
          const SizedBox(height: 2),
          // Four across a 320dp phone leaves little room, and "Classes Today"
          // is the longest label: scale it rather than break the word.
          SizedBox(
            width: double.infinity,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: color),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One period: the bell, the subject, the class and its strength, with a
/// coloured edge and a badge for where it stands.
class _ClassRow extends StatelessWidget {
  const _ClassRow({required this.slot, required this.status, required this.option, this.onMark});

  final TimetableSlot slot;
  final PeriodStanding? status;
  final ClassOption? option;
  final VoidCallback? onMark;

  @override
  Widget build(BuildContext context) {
    final (color, tint, label) = switch (status) {
      PeriodStanding.completed => (AppColors.success, AppColors.successSoft, 'Completed'),
      PeriodStanding.inClass => (AppColors.teal, AppColors.tealSoft, 'In Class'),
      PeriodStanding.upcoming => (AppColors.warning, AppColors.warningSoft, 'Upcoming'),
      null => (AppColors.border, AppColors.background, ''),
    };
    final students = option == null ? null : '${option!.studentCount} Students';

    return AppCard(
      onTap: onMark,
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(width: 4, child: ColoredBox(color: color)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              slot.timeLabel == null
                                  ? 'Period ${slot.periodNumber}'
                                  : '${_clock(slot.startTime)} – ${_clock(slot.endTime)}',
                              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              slot.subjectName ?? 'No subject set',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              [
                                'Class ${slot.holderName ?? '—'}',
                                if (students != null) students,
                              ].join('  •  '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      if (label.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        StatusChip(label: label, color: color, tint: tint),
                      ],
                      if (onMark != null)
                        const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 22),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "08:00" as the bell is read aloud: "08:00 AM".
String _clock(String? time) {
  final minutes = timeToMinutes(time);
  if (minutes == null) return '';
  return DateFormat('hh:mm a').format(DateTime(2000, 1, 1, minutes ~/ 60, minutes % 60));
}
