import 'package:flutter/material.dart';

import '../data/timetable_models.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';
import 'app_chips.dart';
import 'state_views.dart';

/// A week of periods: day chips over the selected day's rows. Both apps show
/// this — the principal a class's week, the teacher their own — so the only
/// difference is what [TimetableSlot.holderName] names, which the caller
/// labels through [holderIcon].
class TimetableWeekView extends StatefulWidget {
  const TimetableWeekView({
    super.key,
    required this.week,
    required this.holderIcon,
    required this.emptyMessage,
  });

  final WeekTimetable week;

  /// The icon beside [TimetableSlot.holderName]: a person in the principal
  /// app, a classroom in the teacher app.
  final IconData holderIcon;

  /// Shown on a weekday with nothing scheduled.
  final String emptyMessage;

  @override
  State<TimetableWeekView> createState() => _TimetableWeekViewState();
}

class _TimetableWeekViewState extends State<TimetableWeekView> {
  int? _selected;

  int get _index {
    final selected = _selected ?? widget.week.indexOfToday(DateTime.now());
    return selected.clamp(0, widget.week.days.isEmpty ? 0 : widget.week.days.length - 1);
  }

  @override
  Widget build(BuildContext context) {
    final days = widget.week.days;
    if (days.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(icon: Icons.schedule_rounded, title: 'No timetable yet'),
      );
    }

    final now = DateTime.now();
    final day = days[_index];
    // Only the real today gets Now/Upcoming; browsing Friday on a Tuesday must
    // not claim a period is running.
    final isToday = _index == widget.week.indexOfToday(now) && now.weekday <= DateTime.friday;
    final badges = isToday
        ? periodBadges(
            day.periods.map((period) => (start: period.startMinute, end: period.endMinute)).toList(),
            now,
          )
        : List<PeriodBadge?>.filled(day.periods.length, null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedTabs(
          labels: [for (final entry in days) entry.shortLabel],
          counts: [for (final entry in days) entry.taughtPeriods],
          index: _index,
          onChanged: (index) => setState(() => _selected = index),
        ),
        const SizedBox(height: 14),
        if (day.periods.isEmpty || day.taughtPeriods == 0)
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(
              icon: Icons.free_breakfast_rounded,
              title: 'Nothing on ${day.label}',
              message: widget.emptyMessage,
            ),
          )
        else
          for (var position = 0; position < day.periods.length; position++) ...[
            _PeriodRow(
              slot: day.periods[position],
              badge: badges[position],
              holderIcon: widget.holderIcon,
            ),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _PeriodRow extends StatelessWidget {
  const _PeriodRow({required this.slot, required this.badge, required this.holderIcon});

  final TimetableSlot slot;
  final PeriodBadge? badge;
  final IconData holderIcon;

  @override
  Widget build(BuildContext context) {
    final free = slot.isFree;
    final accent = free ? AppColors.textMuted : AppColors.primary;

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(
              color: free ? AppColors.background : AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Column(
              children: [
                const Text(
                  'P',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted),
                ),
                Text(
                  '${slot.periodNumber}',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: accent),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  free ? 'Free period' : slot.subjectName ?? 'Subject not set',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: free ? AppColors.textSecondary : AppColors.textPrimary,
                  ),
                ),
                if (slot.holderName != null) ...[
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Icon(holderIcon, size: 13, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          slot.holderName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusChip(
                      label: slot.timeLabel ?? 'No bell time',
                      color: slot.timeLabel == null ? AppColors.textMuted : AppColors.textSecondary,
                      tint: AppColors.background,
                    ),
                    if (badge == PeriodBadge.now)
                      const StatusChip(label: 'Now', color: AppColors.success, tint: AppColors.successSoft)
                    else if (badge == PeriodBadge.upcoming)
                      const StatusChip(label: 'Upcoming', color: AppColors.warning, tint: AppColors.warningSoft),
                    // Kept short: at 1.3x text on a 320dp phone a longer chip
                    // does not fit beside the bell time.
                    if (slot.contestedBy > 0)
                      const StatusChip(
                        label: 'Double-booked',
                        color: AppColors.danger,
                        tint: AppColors.dangerSoft,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
