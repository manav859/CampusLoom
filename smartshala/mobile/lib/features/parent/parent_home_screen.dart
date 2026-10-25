import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/data/calendar_models.dart';
import '../../core/data/messages_models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/announcement_detail_screen.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';
import 'parent_attendance_screen.dart';
import 'widgets/child_avatar.dart';

/// Amounts show as "₹ 2,500" — grouped Indian digits, no paise.
final _money = NumberFormat.decimalPattern('en_IN');

/// The five-section Home tab for the selected child: the brand row, a greeting
/// to the parent, the student card, this month's attendance, the fee status,
/// the next upcoming event and the latest announcement. Fees, events and
/// announcements are best-effort — a child's attendance home still loads if any
/// of them fail.
class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({
    super.key,
    required this.child,
    this.onChangeChild,
    required this.onSelectTab,
  });

  final ParentChild child;

  /// Back to the student picker; null when the parent has a single child.
  final VoidCallback? onChangeChild;

  /// Switches the shell's bottom tab (1 Fees, 2 Calendar, 3 Messages).
  final ValueChanged<int> onSelectTab;

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  _HomeData? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(ParentHomeScreen old) {
    super.didUpdateWidget(old);
    if (old.child.id != widget.child.id) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<ParentRepository>();
      final childId = widget.child.id;

      // Attendance home is essential; the rest degrade to empty on error so one
      // failing endpoint never blanks the whole screen.
      final homeF = repo.home(childId);
      final feesF = repo.fees(childId).then<ChildFees?>((v) => v, onError: (_) => null);
      final eventsF = repo
          .calendar(DateTime.now())
          .then<List<CalendarEvent>>((v) => v, onError: (_) => const <CalendarEvent>[]);
      final annF = repo
          .announcements(limit: 5)
          .then<AnnouncementPage>((v) => v, onError: (_) => AnnouncementPage.empty);

      final home = await homeF;
      final fees = await feesF;
      final events = await eventsF;
      final announcements = await annF;

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final upcoming = events.where((e) => !e.endDate.isBefore(today)).toList()
        ..sort((a, b) => a.startDate.compareTo(b.startDate));

      if (!mounted) return;
      setState(() {
        _data = _HomeData(
          home: home,
          fees: fees,
          nextEvent: upcoming.isEmpty ? null : upcoming.first,
          latestAnnouncement: announcements.items.isEmpty ? null : announcements.items.first,
        );
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

  void _openAttendance() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => ParentAttendanceScreen(childId: widget.child.id, childName: widget.child.fullName),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
        children: [
          HomeBrandRow(
            actions: [
              HomeHeaderButton(
                icon: Icons.notifications_none_rounded,
                tooltip: 'Notifications',
                onTap: () => widget.onSelectTab(3),
              ),
            ],
          ),
          const SizedBox(height: 18),
          HomeGreeting(
            name: '${_data?.home.parentName.isNotEmpty == true ? _data!.home.parentName : 'Parent'} 👋',
            subtitle: "Here's everything about your child's school life.",
          ),
          const SizedBox(height: 16),
          _StudentCard(child: widget.child, onTap: widget.onChangeChild),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: LoadingView(),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: ErrorView(message: _error!, onRetry: _load),
            )
          else ...[
            const SizedBox(height: 14),
            _AttendanceCard(summary: _data!.home.attendance, onViewAll: _openAttendance),
            const SizedBox(height: 14),
            _FeeStatusCard(
              fees: _data!.fees,
              onViewDetails: () => widget.onSelectTab(1),
              onPay: () => widget.onSelectTab(1),
            ),
            const SizedBox(height: 14),
            _UpcomingEventsCard(event: _data!.nextEvent, onViewAll: () => widget.onSelectTab(2)),
            const SizedBox(height: 14),
            _AnnouncementsCard(
              announcement: _data!.latestAnnouncement,
              onViewAll: () => widget.onSelectTab(3),
            ),
          ],
        ],
      ),
    );
  }
}

class _HomeData {
  const _HomeData({
    required this.home,
    required this.fees,
    required this.nextEvent,
    required this.latestAnnouncement,
  });

  final ChildHome home;
  final ChildFees? fees;
  final CalendarEvent? nextEvent;
  final Announcement? latestAnnouncement;
}

/// The selected child's identity, as the big card under the greeting.
class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.child, this.onTap});

  final ParentChild child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (child.className != null) 'Class ${child.className}',
      if (child.rollNumber != null) 'Roll No. ${child.rollNumber}',
    ].join('   |   ');

    return HomeSurface(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          ChildAvatar(child: child, size: 52),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          if (onTap != null) const _ChangePill(),
        ],
      ),
    );
  }
}

/// The switch-child affordance on the student card — shown only when the parent
/// has more than one child.
class _ChangePill extends StatelessWidget {
  const _ChangePill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 6, 12, 6),
      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.swap_horiz_rounded, size: 16, color: AppColors.primary),
          SizedBox(width: 5),
          Text('Change', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
        ],
      ),
    );
  }
}

/// The shared top of every section card: a tinted icon chip, a title and
/// subtitle, and a right-aligned "View All / View Details" link.
class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.icon,
    required this.accent,
    required this.tint,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final Color accent;
  final Color tint;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, size: 22, color: accent),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        InkWell(
          onTap: onAction,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  actionLabel,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.primary),
                ),
                const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.primary),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// This month's attendance: the percentage over a progress bar, with the
/// present/absent counts beneath.
class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.summary, required this.onViewAll});

  final AttendanceSummary summary;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final pct = summary.percentage.clamp(0, 100).toDouble();
    final pctLabel = pct.floor().toString();

    return HomeSurface(
      padding: const EdgeInsets.all(16),
      onTap: onViewAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeader(
            icon: Icons.event_available_rounded,
            accent: AppColors.primary,
            tint: AppColors.primarySoft,
            title: 'Attendance',
            subtitle: "Your child's attendance this month",
            actionLabel: 'View All',
            onAction: onViewAll,
          ),
          const SizedBox(height: 14),
          Text(
            '$pctLabel%',
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 8,
              backgroundColor: Home.line,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('${summary.present} Present',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
              const SizedBox(width: 10),
              const Text('|', style: TextStyle(fontSize: 12.5, color: AppColors.textMuted)),
              const SizedBox(width: 10),
              Text('${summary.absent} Absent',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Total dues, the status pill and a Pay Now shortcut to the Fees tab. Cleared
/// fees drop the button and show a Paid pill.
class _FeeStatusCard extends StatelessWidget {
  const _FeeStatusCard({required this.fees, required this.onViewDetails, required this.onPay});

  final ChildFees? fees;
  final VoidCallback onViewDetails;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final balance = fees?.balance ?? 0;
    final cleared = fees == null || balance <= 0;
    final (chipLabel, chipColor, chipTint) = cleared
        ? ('Paid', AppColors.success, AppColors.successSoft)
        : fees!.status == 'PARTIAL'
            ? ('Partial', AppColors.warning, AppColors.warningSoft)
            : ('Pending', AppColors.danger, AppColors.dangerSoft);

    return HomeSurface(
      padding: const EdgeInsets.all(16),
      onTap: onViewDetails,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeader(
            icon: Icons.currency_rupee_rounded,
            accent: AppColors.purple,
            tint: AppColors.purpleSoft,
            title: 'Fee Status',
            subtitle: 'Total dues and recent payments',
            actionLabel: 'View Details',
            onAction: onViewDetails,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Flexible(
                child: Text(
                  '₹ ${_money.format(cleared ? 0 : balance)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: cleared ? AppColors.success : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _Pill(label: chipLabel, color: chipColor, tint: chipTint),
              const Spacer(),
              if (!cleared)
                FilledButton(
                  onPressed: onPay,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                  child: const Text('Pay Now'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The next upcoming event (meeting, exam or holiday), with a link to the full
/// calendar.
class _UpcomingEventsCard extends StatelessWidget {
  const _UpcomingEventsCard({required this.event, required this.onViewAll});

  final CalendarEvent? event;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final e = event;
    final when = e == null
        ? null
        : [
            DateFormat('d MMM').format(e.startDate),
            if (formatEventTime(e.startTime) != null) formatEventTime(e.startTime)!,
          ].join(' · ');

    return HomeSurface(
      padding: const EdgeInsets.all(16),
      onTap: onViewAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeader(
            icon: Icons.event_rounded,
            accent: Home.green,
            tint: Home.greenSoft,
            title: 'Upcoming Events',
            subtitle: 'Meetings, exams and more',
            actionLabel: 'View All',
            onAction: onViewAll,
          ),
          const SizedBox(height: 12),
          if (e == null)
            const _EmptyRow(text: 'No upcoming events.')
          else
            _InsetRow(
              title: e.title,
              subtitle: when,
              onTap: onViewAll,
            ),
        ],
      ),
    );
  }
}

/// The most recent announcement, with a link to the Messages tab.
class _AnnouncementsCard extends StatelessWidget {
  const _AnnouncementsCard({required this.announcement, required this.onViewAll});

  final Announcement? announcement;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final a = announcement;
    return HomeSurface(
      padding: const EdgeInsets.all(16),
      onTap: onViewAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeader(
            icon: Icons.campaign_rounded,
            accent: Home.amber,
            tint: Home.amberSoft,
            title: 'Latest Announcements',
            subtitle: 'Stay updated with school news',
            actionLabel: 'View All',
            onAction: onViewAll,
          ),
          const SizedBox(height: 12),
          if (a == null)
            const _EmptyRow(text: 'No announcements yet.')
          else
            _InsetRow(
              title: a.title,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => AnnouncementDetailScreen(announcement: a)),
              ),
            ),
        ],
      ),
    );
  }
}

/// A single preview row on a soft inset, led by a dot and trailed by a chevron.
class _InsetRow extends StatelessWidget {
  const _InsetRow({required this.title, this.subtitle, this.onTap});

  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.background,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 2),
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color, required this.tint});

  final String label;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(20)),
      child: Text(
        label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
