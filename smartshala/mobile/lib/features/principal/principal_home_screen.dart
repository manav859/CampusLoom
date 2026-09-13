import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/app_user.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/data/dashboard_models.dart';
import '../../core/data/messages_models.dart';
import '../../core/data/messages_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/brand_header.dart';
import '../../core/widgets/dashboard_widgets.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/state_views.dart';
import 'announcements/create_announcement_screen.dart';
import 'data/principal_dashboard.dart';
import 'data/principal_repository.dart';
import 'leave/leave_approval_screen.dart';

/// The principal command centre. It reads what the web admin dashboard reads
/// (GET /dashboard and today's GET /activity-logs) and shows the same KPIs,
/// charts, alerts and activity in the same order. The school card and Quick
/// Actions are app-only; on the web the page title and sidebar do those jobs.
class PrincipalHomeScreen extends StatefulWidget {
  const PrincipalHomeScreen({super.key, this.onOpenMessages});

  /// Opens the Messages tab; the bell and the Messages action call it.
  final VoidCallback? onOpenMessages;

  @override
  State<PrincipalHomeScreen> createState() => _PrincipalHomeScreenState();
}

class _HomeData {
  const _HomeData({
    required this.dashboard,
    required this.activity,
    required this.pendingLeave,
  });

  final PrincipalDashboard dashboard;
  final List<ActivityEntry> activity;
  final int pendingLeave;
}

class _PrincipalHomeScreenState extends State<PrincipalHomeScreen> {
  late Future<_HomeData> _future;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final repository = context.read<PrincipalRepository>();
    final messages = context.read<MessagesRepository>();

    // Only the dashboard is essential. The web shows the rest as optional
    // panels, so a failure there leaves that panel empty, not the whole screen.
    final results = await Future.wait<Object>([
      repository.dashboard(),
      repository
          .activity(DateTime.now())
          .then<Object>(
            (value) => value,
            onError: (Object _) => <ActivityEntry>[],
          ),
      messages
          .schoolLeave(status: LeaveStatus.pending, limit: 1)
          .then<Object>(
            (page) => page.summary.pending,
            onError: (Object _) => 0,
          ),
      messages
          .announcements(limit: 1)
          .then<Object>((page) => page.unreadCount, onError: (Object _) => 0),
    ]);

    if (mounted) setState(() => _unreadCount = results[3] as int);
    return _HomeData(
      dashboard: results[0] as PrincipalDashboard,
      activity: results[1] as List<ActivityEntry>,
      pendingLeave: results[2] as int,
    );
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() => _future = future);
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _openAndRefresh(Widget screen) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BrandAppBar(
        portalLabel: 'PRINCIPAL APP',
        notificationCount: _unreadCount,
        onNotificationsTap: widget.onOpenMessages,
        leading: IconButton(
          icon: const Icon(Icons.logout_rounded, size: 22),
          tooltip: 'Sign out',
          onPressed: () => context.read<AuthController>().logout(),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_HomeData>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const LoadingView(message: 'Loading your school…');
            }

            if (snapshot.hasError) {
              final error = snapshot.error;
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.18),
                  ErrorView(
                    message: error is ApiException
                        ? error.message
                        : 'Could not load the dashboard.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final data = snapshot.data!;
            final dashboard = data.dashboard;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                const _SchoolCard(),
                const SizedBox(height: 14),
                Text(
                  dashboard.pulse,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 14),
                _KpiGrid(dashboard: dashboard),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Quick Actions'),
                _QuickActions(
                  pendingLeave: data.pendingLeave,
                  onLeave: () => _openAndRefresh(const LeaveApprovalScreen()),
                  onAnnouncement: () =>
                      _openAndRefresh(const CreateAnnouncementScreen()),
                  onMessages: widget.onOpenMessages,
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Attendance in Marked Classes'),
                ClassAttendanceCard(
                  classes: dashboard.attendance,
                  markedOnly: true,
                  emptyTitle: 'No classes marked yet today',
                  emptyMessage:
                      'Class attendance appears here as teachers submit it.',
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Fee Overview'),
                // The web Fee Overview donut's segments and colours.
                SegmentBarCard(
                  segments: [
                    (
                      label: 'Collected',
                      value: dashboard.totalCollected,
                      color: const Color(0xFF34C759),
                    ),
                    (
                      label: 'Pending',
                      value: dashboard.totalPending,
                      color: const Color(0xFFFF3B30),
                    ),
                  ],
                  format: (value) => formatInr(value),
                  emptyMessage:
                      'Collection and pending totals appear after fees are assigned.',
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Alerts'),
                ActionAlertList(alerts: dashboard.actionAlerts),
                const SizedBox(height: 22),
                const SectionHeader(title: "Today's Activity"),
                ActivityList(entries: data.activity, now: DateTime.now()),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SchoolCard extends StatelessWidget {
  const _SchoolCard();

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthController, AppUser?>((auth) => auth.user);
    final schoolName = user?.schoolName ?? '';

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: const Icon(
              Icons.apartment_rounded,
              color: AppColors.primary,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  schoolName.isNotEmpty ? schoolName : 'Your school',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                ),
                Text(
                  'Welcome, ${user?.fullName ?? 'Principal'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                  style: const TextStyle(
                    fontSize: 12,
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

/// The web admin dashboard's five KPI cards, with the same labels, order and colours.
class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.dashboard});

  final PrincipalDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        label: 'Students',
        value: '${dashboard.totalStudents}',
        icon: Icons.school_rounded,
      ),
      (
        label: 'Marked Today',
        value: '${dashboard.markedTodayPercentage}%',
        icon: Icons.fact_check_rounded,
      ),
      (
        label: 'Defaulters',
        value: '${dashboard.defaulterCount}',
        icon: Icons.groups_rounded,
      ),
      (
        label: 'Collected',
        value: formatInr(dashboard.totalCollected),
        icon: Icons.savings_rounded,
      ),
      (
        label: 'Alerts',
        value: '${dashboard.alertCount}',
        icon: Icons.warning_amber_rounded,
      ),
    ];

    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 5,
      children: [
        for (var index = 0; index < cards.length; index++)
          KpiCard(
            index: index,
            label: cards[index].label,
            value: cards[index].value,
            icon: cards[index].icon,
          ),
      ],
    );
  }
}

/// A short list, per the blueprint: only actions the app can complete today.
class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.pendingLeave,
    required this.onLeave,
    required this.onAnnouncement,
    required this.onMessages,
  });

  final int pendingLeave;
  final VoidCallback onLeave;
  final VoidCallback onAnnouncement;
  final VoidCallback? onMessages;

  @override
  Widget build(BuildContext context) {
    return ResponsiveGrid(
      phoneColumns: 3,
      wideColumns: 3,
      children: [
        _ActionTile(
          icon: Icons.event_available_rounded,
          title: 'Leave Approval',
          color: AppColors.success,
          badge: pendingLeave,
          onTap: onLeave,
        ),
        _ActionTile(
          icon: Icons.campaign_rounded,
          title: 'Announcement',
          color: AppColors.purple,
          onTap: onAnnouncement,
        ),
        _ActionTile(
          icon: Icons.forum_rounded,
          title: 'Messages',
          color: AppColors.primary,
          onTap: onMessages,
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.color,
    this.badge = 0,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final Color color;
  final int badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(AppRadii.card),
                ),
                child: Icon(icon, size: 22, color: color),
              ),
              if (badge > 0)
                Positioned(
                  right: -8,
                  top: -6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    constraints: const BoxConstraints(minWidth: 20),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}
