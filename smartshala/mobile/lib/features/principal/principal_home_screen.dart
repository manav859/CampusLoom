import 'dart:math' as math;

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
import 'calendar/academic_calendar_screen.dart';
import 'data/principal_dashboard.dart';
import 'data/quick_actions_store.dart';
import 'data/principal_repository.dart';
import 'exams/exams_screen.dart';
import 'fees/defaulters_screen.dart';
import 'fees/fee_management_screen.dart';
import 'leave/leave_approval_screen.dart';
import 'payroll/payroll_screen.dart';
import 'quick_actions_sheet.dart';
import 'reports/attendance_report_screen.dart';
import 'reports/student_report_screen.dart';
import 'students/student_management_screen.dart';
import 'teachers/teacher_management_screen.dart';

/// The principal command centre, kept short on purpose: four overview cards,
/// Quick Actions, today's attendance in one card, Fee Overview, the three most
/// important pending items and today's key events. It reads GET /dashboard,
/// today's GET /activity-logs and the pending leave count; everything else
/// lives in More.
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

  final _quickActionsStore = QuickActionsStore();
  List<QuickActionKey> _quickActions = QuickActionsStore.defaults;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _loadQuickActions();
  }

  Future<void> _loadQuickActions() async {
    final keys = await _quickActionsStore.read();
    if (mounted) setState(() => _quickActions = keys);
  }

  Future<void> _editQuickActions() async {
    final chosen = await QuickActionsSheet.show(context, selected: _quickActions);
    if (chosen == null || !mounted) return;
    setState(() => _quickActions = chosen);

    try {
      await _quickActionsStore.write(chosen);
    } on Exception {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.danger,
            content: Text('Quick Actions updated for now, but could not be saved.'),
          ),
        );
    }
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
    setState(() { _future = future; });
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
                _KpiGrid(
                  dashboard: dashboard,
                  pendingActions:
                      dashboard.pendingActions(pendingLeave: data.pendingLeave),
                  onStudents: () => _openAndRefresh(const StudentManagementScreen()),
                  onAttendance: () => _openAndRefresh(const AttendanceReportScreen()),
                  onCollected: () => _openAndRefresh(const FeeManagementScreen()),
                ),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Quick Actions',
                  action: TextButton(
                    onPressed: _editQuickActions,
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Text('Edit', style: TextStyle(fontSize: 13)),
                  ),
                ),
                _QuickActions(
                  keys: _quickActions,
                  pendingLeave: data.pendingLeave,
                  onStudents: () => _openAndRefresh(const StudentManagementScreen()),
                  onTeachers: () => _openAndRefresh(const TeacherManagementScreen()),
                  onAttendance: () => _openAndRefresh(const AttendanceReportScreen()),
                  onFees: () => _openAndRefresh(const FeeManagementScreen()),
                  onLeave: () => _openAndRefresh(const LeaveApprovalScreen()),
                  onNotice: () =>
                      _openAndRefresh(const CreateAnnouncementScreen()),
                  onPayroll: () => _openAndRefresh(const PayrollScreen()),
                  onCalendar: () => _openAndRefresh(const AcademicCalendarScreen()),
                  onExams: () => _openAndRefresh(const ExamsScreen()),
                ),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Attendance Today',
                  action: TextButton(
                    onPressed: () =>
                        _openAndRefresh(const AttendanceReportScreen()),
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('View All', style: TextStyle(fontSize: 13)),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward_rounded, size: 15),
                      ],
                    ),
                  ),
                ),
                _AttendanceToday(
                  dashboard: dashboard,
                  onTap: () => _openAndRefresh(const AttendanceReportScreen()),
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
                const SectionHeader(title: 'Needs Your Attention'),
                _NeedsAttention(
                  items: dashboard
                      .attentionItems(pendingLeave: data.pendingLeave)
                      .take(3)
                      .toList(),
                  onTap: (kind) => _openAndRefresh(switch (kind) {
                    AttentionKind.leave => const LeaveApprovalScreen(),
                    AttentionKind.attendance => const AttendanceReportScreen(),
                    AttentionKind.students => const StudentReportScreen(),
                    AttentionKind.fees => const DefaultersScreen(),
                  }),
                ),
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

/// Students, Attendance, Fee Collected and Pending Actions.
class _KpiGrid extends StatelessWidget {
  const _KpiGrid({
    required this.dashboard,
    required this.pendingActions,
    this.onStudents,
    this.onAttendance,
    this.onCollected,
  });

  final PrincipalDashboard dashboard;
  final int pendingActions;
  final VoidCallback? onStudents;
  final VoidCallback? onAttendance;
  final VoidCallback? onCollected;

  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        label: 'Students',
        value: '${dashboard.totalStudents}',
        icon: Icons.school_rounded,
        onTap: onStudents,
      ),
      (
        label: 'Attendance',
        value: dashboard.attendanceLabel,
        icon: Icons.fact_check_rounded,
        onTap: onAttendance,
      ),
      (
        label: 'Fee Collected',
        value: formatInr(dashboard.totalCollected),
        icon: Icons.savings_rounded,
        onTap: onCollected,
      ),
      (
        label: 'Pending Actions',
        value: '$pendingActions',
        icon: Icons.pending_actions_rounded,
        // Needs Your Attention, further down, breaks this number down.
        onTap: null,
      ),
    ];

    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 4,
      children: [
        for (final card in cards)
          KpiCard(
            index: cards.indexOf(card),
            label: card.label,
            value: card.value,
            icon: card.icon,
            onTap: card.onTap,
          ),
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.keys,
    required this.pendingLeave,
    required this.onStudents,
    required this.onTeachers,
    required this.onAttendance,
    required this.onFees,
    required this.onLeave,
    required this.onNotice,
    required this.onPayroll,
    required this.onCalendar,
    required this.onExams,
  });

  final List<QuickActionKey> keys;
  final int pendingLeave;
  final VoidCallback onStudents;
  final VoidCallback onTeachers;
  final VoidCallback onAttendance;
  final VoidCallback onFees;
  final VoidCallback onLeave;
  final VoidCallback onNotice;
  final VoidCallback onPayroll;
  final VoidCallback onCalendar;
  final VoidCallback onExams;

  /// Every tile the principal can choose from, in grid order. The six of the
  /// blueprint come first, so the default selection is two neat rows.
  ({IconData icon, String title, Color color, int badge, VoidCallback onTap})
      _spec(QuickActionKey key) => switch (key) {
            QuickActionKey.students => (
                icon: Icons.school_rounded,
                title: 'Students',
                color: AppColors.teal,
                badge: 0,
                onTap: onStudents,
              ),
            QuickActionKey.teachers => (
                icon: Icons.badge_rounded,
                title: 'Teachers',
                color: AppColors.primary,
                badge: 0,
                onTap: onTeachers,
              ),
            QuickActionKey.attendance => (
                icon: Icons.fact_check_rounded,
                title: 'Attendance',
                color: AppColors.success,
                badge: 0,
                onTap: onAttendance,
              ),
            QuickActionKey.fees => (
                icon: Icons.payments_rounded,
                title: 'Fees',
                color: AppColors.warning,
                badge: 0,
                onTap: onFees,
              ),
            QuickActionKey.leave => (
                icon: Icons.event_available_rounded,
                title: 'Leave Requests',
                color: AppColors.danger,
                badge: pendingLeave,
                onTap: onLeave,
              ),
            QuickActionKey.notice => (
                icon: Icons.campaign_rounded,
                title: 'Send Notice',
                color: AppColors.purple,
                badge: 0,
                onTap: onNotice,
              ),
            QuickActionKey.payroll => (
                icon: Icons.account_balance_wallet_rounded,
                title: 'Payroll',
                color: AppColors.success,
                badge: 0,
                onTap: onPayroll,
              ),
            QuickActionKey.calendar => (
                icon: Icons.calendar_month_rounded,
                title: 'Calendar',
                color: AppColors.teal,
                badge: 0,
                onTap: onCalendar,
              ),
            QuickActionKey.exams => (
                icon: Icons.assignment_rounded,
                title: 'Exams',
                color: AppColors.primary,
                badge: 0,
                onTap: onExams,
              ),
          };

  @override
  Widget build(BuildContext context) {
    // Three to a row: the default six are two rows, and Edit can grow it.
    return ResponsiveGrid(
      phoneColumns: 3,
      wideColumns: 9,
      children: [
        for (final key in keys)
          if (key.available)
            _ActionTile(
              icon: _spec(key).icon,
              title: _spec(key).title,
              color: _spec(key).color,
              badge: _spec(key).badge,
              onTap: _spec(key).onTap,
            ),
      ],
    );
  }
}

/// The share of students present as a ring, beside the two counts that
/// explain it: classes marked, and students present out of the roll.
class _AttendanceToday extends StatelessWidget {
  const _AttendanceToday({required this.dashboard, this.onTap});

  final PrincipalDashboard dashboard;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      child: Row(
        children: [
          _AttendanceDonut(
            // attendanceLabel reads "—" until the first class is marked, so
            // the ring is empty rather than showing a 0% nobody measured.
            label: dashboard.attendanceLabel,
            fraction: dashboard.classesMarked == 0
                ? 0
                : dashboard.attendancePercentage / 100,
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _AttendanceFact(
                  icon: Icons.menu_book_rounded,
                  value: '${dashboard.classesMarked} / ${dashboard.totalClasses}',
                  caption: 'classes marked',
                ),
                const SizedBox(height: 16),
                _AttendanceFact(
                  icon: Icons.groups_rounded,
                  value: '${dashboard.studentsPresent} students present',
                  caption: 'out of ${dashboard.totalStudents}',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A ring with the percentage in the middle.
class _AttendanceDonut extends StatelessWidget {
  const _AttendanceDonut({required this.label, required this.fraction});

  final String label;
  final double fraction;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 98,
      height: 98,
      child: CustomPaint(
        painter: _DonutPainter(fraction: fraction.clamp(0.0, 1.0)),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w700),
                ),
              ),
              const Text(
                'Overall',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.fraction});

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 11.0;
    final box = Offset(stroke / 2, stroke / 2) &
        Size(size.width - stroke, size.height - stroke);

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;

    canvas.drawArc(box, 0, math.pi * 2, false, ring..color = AppColors.border);
    if (fraction <= 0) return;

    canvas.drawArc(
      box,
      // Twelve o'clock, so the arc reads like a dial rather than starting
      // from the right-hand edge.
      -math.pi / 2,
      math.pi * 2 * fraction,
      false,
      ring
        ..color = AppColors.primary
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_DonutPainter oldDelegate) => oldDelegate.fraction != fraction;
}

/// One tinted icon, a bold number and the caption under it.
class _AttendanceFact extends StatelessWidget {
  const _AttendanceFact({
    required this.icon,
    required this.value,
    required this.caption,
  });

  final IconData icon;
  final String value;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
          child: Icon(icon, size: 20, color: AppColors.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
              ),
              Text(
                caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Up to three pending items, each opening the screen that clears it.
class _NeedsAttention extends StatelessWidget {
  const _NeedsAttention({required this.items, required this.onTap});

  final List<AttentionItem> items;
  final ValueChanged<AttentionKind> onTap;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.verified_rounded,
          title: 'All caught up',
          message: 'Nothing is waiting on you right now.',
        ),
      );
    }

    String plural(int count, String one, String many) =>
        '$count ${count == 1 ? one : many}';

    return Column(
      children: [
        for (final item in items) ...[
          if (item != items.first) const SizedBox(height: 8),
          switch (item.kind) {
            AttentionKind.leave => ListRowCard(
              icon: Icons.event_available_rounded,
              title: plural(item.count, 'leave request', 'leave requests'),
              subtitle: 'Awaiting your approval',
              color: AppColors.danger,
              onTap: () => onTap(item.kind),
            ),
            AttentionKind.attendance => ListRowCard(
              icon: Icons.fact_check_rounded,
              title: plural(item.count, 'class', 'classes'),
              subtitle: 'Attendance not marked yet today',
              color: AppColors.warning,
              onTap: () => onTap(item.kind),
            ),
            AttentionKind.students => ListRowCard(
              icon: Icons.warning_amber_rounded,
              title: plural(item.count, 'student flagged', 'students flagged'),
              subtitle: 'Low attendance, repeat absences or high risk',
              color: AppColors.purple,
              onTap: () => onTap(item.kind),
            ),
            AttentionKind.fees => ListRowCard(
              icon: Icons.currency_rupee_rounded,
              title: plural(item.count, 'fee defaulter', 'fee defaulters'),
              subtitle: 'Fees pending follow-up',
              color: AppColors.teal,
              onTap: () => onTap(item.kind),
            ),
          },
        ],
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
