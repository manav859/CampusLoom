import 'package:flutter/material.dart';

import '../data/dashboard_models.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';
import 'app_chips.dart';
import 'state_views.dart';

/// Today's attendance per class — the web's attendance chart as a list of bars,
/// which reads better at phone width. [onMark] makes unmarked rows tappable;
/// [markedOnly] mirrors the principal chart, which plots marked classes only.
class ClassAttendanceCard extends StatelessWidget {
  const ClassAttendanceCard({
    super.key,
    required this.classes,
    this.onMark,
    this.markedOnly = false,
    this.emptyTitle = 'No classes assigned',
    this.emptyMessage = 'Classes you teach will show their attendance here.',
  });

  final List<ClassAttendance> classes;
  final VoidCallback? onMark;
  final bool markedOnly;
  final String emptyTitle;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final rows = markedOnly
        ? classes.where((item) => item.marked).toList()
        : classes;

    if (rows.isEmpty) {
      return AppCard(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.bar_chart_rounded,
          title: emptyTitle,
          message: emptyMessage,
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      child: Column(
        children: [
          for (var index = 0; index < rows.length; index++) ...[
            if (index > 0) const Divider(),
            _ClassAttendanceRow(item: rows[index], onMark: onMark),
          ],
        ],
      ),
    );
  }
}

class _ClassAttendanceRow extends StatelessWidget {
  const _ClassAttendanceRow({required this.item, this.onMark});

  final ClassAttendance item;
  final VoidCallback? onMark;

  @override
  Widget build(BuildContext context) {
    final percent = item.attendancePercentage.clamp(0, 100);
    final color = percent >= 75
        ? AppColors.success
        : percent >= 60
        ? AppColors.warning
        : AppColors.danger;

    return InkWell(
      onTap: item.marked ? null : onMark,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Class ${item.className}',
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (item.marked)
                  Text(
                    '$percent%',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  )
                else
                  const StatusChip(
                    label: 'Not marked',
                    color: AppColors.warning,
                    tint: AppColors.warningSoft,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: item.marked ? percent / 100 : 0,
                minHeight: 6,
                color: color,
                backgroundColor: AppColors.background,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.marked
                  ? '${item.present} present · ${item.absent} absent · ${item.totalStudents} students'
                  : '${item.totalStudents} students${onMark == null ? '' : ' · tap to mark'}',
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

typedef Segment = ({String label, num value, Color color});

/// The web's donut charts (Fee Overview, Today's Actions) as one stacked bar
/// with the same colours and a legend. [format] renders each value.
class SegmentBarCard extends StatelessWidget {
  const SegmentBarCard({
    super.key,
    required this.segments,
    this.format,
    this.emptyMessage,
  });

  final List<Segment> segments;
  final String Function(num value)? format;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<num>(0, (sum, segment) => sum + segment.value);
    final render = format ?? (num value) => '$value';

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 12,
              child: total <= 0
                  ? const ColoredBox(
                      color: AppColors.background,
                      child: SizedBox.expand(),
                    )
                  : Row(
                      children: [
                        for (final segment in segments)
                          if (segment.value > 0)
                            Expanded(
                              // Flex needs integers; thousandths keep small shares visible.
                              flex: ((segment.value / total) * 1000)
                                  .round()
                                  .clamp(1, 1000),
                              child: ColoredBox(color: segment.color),
                            ),
                      ],
                    ),
            ),
          ),
          if (total <= 0 && emptyMessage != null) ...[
            const SizedBox(height: 10),
            Text(
              emptyMessage!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              for (final segment in segments)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: segment.color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              segment.label,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          render(segment.value),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The web AlertPanel: label, severity badge, a detail line, red for critical
/// and amber otherwise. [onTap] returns null for alerts that go nowhere.
class ActionAlertList extends StatelessWidget {
  const ActionAlertList({super.key, required this.alerts, this.onTap});

  final List<ActionAlert> alerts;
  final VoidCallback? Function(ActionAlert alert)? onTap;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.verified_rounded,
          title: 'All caught up',
          message: 'No urgent actions right now.',
        ),
      );
    }

    return Column(
      children: [
        for (var index = 0; index < alerts.length; index++) ...[
          if (index > 0) const SizedBox(height: 8),
          _ActionAlertRow(
            alert: alerts[index],
            onTap: onTap?.call(alerts[index]),
          ),
        ],
      ],
    );
  }
}

class _ActionAlertRow extends StatelessWidget {
  const _ActionAlertRow({required this.alert, this.onTap});

  final ActionAlert alert;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = alert.isDanger ? AppColors.danger : AppColors.warning;
    final tint = alert.isDanger ? AppColors.dangerSoft : AppColors.warningSoft;
    final (badge, badgeColor, badgeTint) = switch (alert.level) {
      ActionLevel.critical => (
        'CRITICAL',
        AppColors.danger,
        AppColors.dangerSoft,
      ),
      ActionLevel.high => ('HIGH', AppColors.warning, AppColors.warningSoft),
      ActionLevel.medium => (
        'MEDIUM',
        AppColors.textSecondary,
        AppColors.background,
      ),
    };

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: tint,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Icon(
              alert.isDanger
                  ? Icons.warning_amber_rounded
                  : Icons.notifications_active_outlined,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.3,
                  ),
                ),
                if (alert.detail != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    alert.detail!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusChip(label: badge, color: badgeColor, tint: badgeTint),
          if (onTap != null)
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.textMuted,
              size: 20,
            ),
        ],
      ),
    );
  }
}

/// The web dashboard's activity feed for today.
class ActivityList extends StatelessWidget {
  const ActivityList({super.key, required this.entries, required this.now});

  final List<ActivityEntry> entries;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.history_rounded,
          title: 'No activity yet today',
          message: 'Changes made in SmartShala today appear here.',
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
      child: Column(
        children: [
          for (var index = 0; index < entries.length; index++) ...[
            if (index > 0) const Divider(),
            _ActivityRow(entry: entries[index], now: now),
          ],
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.entry, required this.now});

  final ActivityEntry entry;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    // The web feed's colours: blue attendance, green fee, red alert, orange message.
    final (icon, color) = switch (entry.type) {
      ActivityType.attendance => (
        Icons.fact_check_rounded,
        const Color(0xFF0071E3),
      ),
      ActivityType.fee => (
        Icons.currency_rupee_rounded,
        const Color(0xFF34C759),
      ),
      ActivityType.alert => (
        Icons.delete_outline_rounded,
        const Color(0xFFFF3B30),
      ),
      ActivityType.message => (
        Icons.chat_bubble_outline_rounded,
        const Color(0xFFFF9500),
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${entry.actorName} · ${relativeTime(entry.createdAt, now)}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
