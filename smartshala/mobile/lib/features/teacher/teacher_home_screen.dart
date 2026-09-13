import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/app_chips.dart';
import '../../core/widgets/brand_header.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/state_views.dart';
import 'attendance/mark_attendance_screen.dart';
import 'calendar/teacher_calendar_screen.dart';
import 'data/punch_controller.dart';
import 'data/teacher_models.dart';
import 'data/teacher_repository.dart';
import 'homework/homework_screen.dart';
import 'leave/apply_leave_screen.dart';
import 'marks/marks_screen.dart';
import 'students/my_students_screen.dart';
import 'students/students_needing_focus_screen.dart';

/// The teacher dashboard. It reads the same endpoints as the web teacher
/// dashboard (GET /dashboard, /users/me/schedule, /staff-attendance/me/today)
/// and shows the same sections in the same order, so a number seen on one is
/// the number on the other. Greeting and Quick Actions are app-only: on the
/// web those jobs belong to the page title and the sidebar.
class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  late Future<_HomeData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final repository = context.read<TeacherRepository>();
    final results = await Future.wait([
      repository.dashboard(),
      repository.todaySchedule(),
    ]);

    return _HomeData(
      dashboard: results[0] as TeacherDashboard,
      schedule: results[1] as List<SchedulePeriod>,
    );
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() => _future = future);
    unawaited(context.read<PunchController>().load());
    await future.catchError((Object _) => _HomeData.empty);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BrandAppBar(
        portalLabel: 'TEACHER PORTAL',
        notificationCount: 3,
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
              return const LoadingView(message: 'Loading your day…');
            }

            if (snapshot.hasError) {
              final error = snapshot.error;
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.18),
                  ErrorView(
                    message: error is ApiException
                        ? error.message
                        : 'Could not load your dashboard.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final data = snapshot.data ?? _HomeData.empty;
            return _HomeBody(data: data);
          },
        ),
      ),
    );
  }
}

class _HomeData {
  const _HomeData({required this.dashboard, required this.schedule});

  final TeacherDashboard dashboard;
  final List<SchedulePeriod> schedule;

  static const empty = _HomeData(dashboard: TeacherDashboard.empty, schedule: []);
}

void _open(BuildContext context, Widget screen) {
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
}

class _HomeBody extends StatelessWidget {
  const _HomeBody({required this.data});

  final _HomeData data;

  @override
  Widget build(BuildContext context) {
    final dashboard = data.dashboard;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const _GreetingCard(),
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
        _KpiGrid(overview: dashboard.overview),
        const SizedBox(height: 22),
        const SectionHeader(title: 'Quick Actions'),
        const _QuickActionsGrid(),
        const SizedBox(height: 22),
        const SectionHeader(title: "Today's Punch"),
        const _PunchCard(),
        const SizedBox(height: 22),
        SectionHeader(
          title: "Today's Schedule",
          action: Text(
            data.schedule.isEmpty ? '' : '${data.schedule.length} periods',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        _ScheduleList(periods: data.schedule),
        const SizedBox(height: 22),
        const SectionHeader(title: 'Your Class Attendance'),
        _ClassAttendanceCard(classes: dashboard.attendance),
        const SizedBox(height: 22),
        const SectionHeader(title: "Today's Actions"),
        _TodaysActionsCard(dashboard: dashboard),
        const SizedBox(height: 22),
        SectionHeader(
          title: 'Alerts',
          action: dashboard.alerts.isEmpty
              ? null
              : StatusChip(
                  label: '${dashboard.alerts.length}',
                  color: AppColors.warning,
                  tint: AppColors.warningSoft,
                ),
        ),
        _AlertsList(alerts: dashboard.alerts),
      ],
    );
  }
}

class _GreetingCard extends StatelessWidget {
  const _GreetingCard();

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthController, dynamic>((auth) => auth.user);
    final now = DateTime.now();
    final greeting = switch (now.hour) {
      < 12 => 'Good Morning,',
      < 17 => 'Good Afternoon,',
      _ => 'Good Evening,',
    };

    return AppCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              user?.initials ?? '?',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  greeting,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                Text(
                  user?.fullName ?? 'Teacher',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.3,
                  ),
                ),
                Text(
                  DateFormat('EEEE, d MMMM yyyy').format(now),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The web teacher dashboard's four KPI cards: same labels, same order, same
/// colours, and each opens the screen its web card links to.
class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.overview});

  final TeacherOverview overview;

  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        label: 'Assigned Students',
        value: overview.assignedStudents,
        icon: Icons.school_rounded,
        screen: const MyStudentsScreen() as Widget,
      ),
      (
        label: 'Pending Attendance',
        value: overview.pendingAttendance,
        icon: Icons.fact_check_rounded,
        screen: const MarkAttendanceScreen() as Widget,
      ),
      (
        label: 'Pending Homework',
        value: overview.pendingHomeworkSubmissions,
        icon: Icons.menu_book_rounded,
        screen: const HomeworkScreen() as Widget,
      ),
      (
        label: 'Assigned Classes',
        value: overview.assignedClasses,
        icon: Icons.class_rounded,
        screen: const MyStudentsScreen() as Widget,
      ),
    ];

    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 4,
      children: [
        for (var index = 0; index < cards.length; index++)
          KpiCard(
            index: index,
            label: cards[index].label,
            value: '${cards[index].value}',
            icon: cards[index].icon,
            onTap: () => _open(context, cards[index].screen),
          ),
      ],
    );
  }
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid();

  @override
  Widget build(BuildContext context) {
    final actions = [
      (
        icon: Icons.fact_check_rounded,
        title: 'Mark Attendance',
        color: AppColors.primary,
        screen: const MarkAttendanceScreen() as Widget?,
      ),
      (
        icon: Icons.menu_book_rounded,
        title: 'Homework',
        color: AppColors.purple,
        screen: const HomeworkScreen() as Widget?,
      ),
      (
        icon: Icons.edit_note_rounded,
        title: 'Marks',
        color: AppColors.warning,
        screen: const MarksScreen() as Widget?,
      ),
      (
        icon: Icons.groups_2_rounded,
        title: 'My Students',
        color: AppColors.teal,
        screen: const MyStudentsScreen() as Widget?,
      ),
      (
        icon: Icons.event_available_rounded,
        title: 'Apply Leave',
        color: AppColors.success,
        screen: const ApplyLeaveScreen() as Widget?,
      ),
      (
        icon: Icons.track_changes_rounded,
        title: 'Students Needing Focus',
        color: AppColors.danger,
        screen: const StudentsNeedingFocusScreen() as Widget?,
      ),
      (
        icon: Icons.calendar_month_rounded,
        title: 'Calendar',
        color: AppColors.primary,
        screen: const TeacherCalendarScreen() as Widget?,
      ),
      (icon: Icons.more_horiz_rounded, title: 'More', color: AppColors.textSecondary, screen: null),
    ];

    return ResponsiveGrid(
      phoneColumns: 4,
      wideColumns: 8,
      children: actions
          .map(
            (action) => _QuickAction(
              icon: action.icon,
              title: action.title,
              color: action.color,
              onTap: action.screen == null
                  ? () => _showComingSoon(context, action.title)
                  : () => _open(context, action.screen!),
            ),
          )
          .toList(),
    );
  }

  void _showComingSoon(BuildContext context, String title) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('$title arrives in a later phase.')));
  }
}

/// Compact square action used in the teacher's 4-across grid.
class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

/// Today's punch, read from the same controller as the Swipe To Punch bar,
/// so it changes the moment the teacher swipes. The web dashboard shows the
/// same three figures.
class _PunchCard extends StatelessWidget {
  const _PunchCard();

  @override
  Widget build(BuildContext context) {
    final punch = context.watch<PunchController>();
    final status = punch.status;
    final timeFormat = DateFormat('h:mm a');

    final (label, color, tint) = switch (status.state) {
      PunchState.notPunchedIn => ('Not punched in', AppColors.warning, AppColors.warningSoft),
      PunchState.punchedIn => ('Punched in', AppColors.success, AppColors.successSoft),
      PunchState.punchedOut => ('Day complete', AppColors.primary, AppColors.primarySoft),
    };

    final figures = [
      ('Punch in', status.punchInAt == null ? '—' : timeFormat.format(status.punchInAt!)),
      ('Punch out', status.punchOutAt == null ? '—' : timeFormat.format(status.punchOutAt!)),
      (
        'Worked',
        status.state == PunchState.notPunchedIn
            ? '—'
            : '${status.workedMinutes ~/ 60}h ${status.workedMinutes % 60}m'
      ),
    ];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Swipe the bar below to punch.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
              if (!punch.isLoading) StatusChip(label: label, color: color, tint: tint),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var index = 0; index < figures.length; index++) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                    ),
                    child: Column(
                      children: [
                        Text(
                          figures[index].$1,
                          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 3),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            punch.isLoading ? '…' : figures[index].$2,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _ScheduleList extends StatefulWidget {
  const _ScheduleList({required this.periods});

  final List<SchedulePeriod> periods;

  @override
  State<_ScheduleList> createState() => _ScheduleListState();
}

class _ScheduleListState extends State<_ScheduleList> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // "Now" and "Upcoming" move with the clock, so the list repaints each minute.
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final periods = widget.periods;
    if (periods.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: EmptyView(
          icon: Icons.event_busy_rounded,
          title: 'No classes scheduled',
          message: 'You have no periods assigned for today.',
        ),
      );
    }

    final badges = scheduleBadges(periods, DateTime.now());

    return Column(
      children: [
        for (var index = 0; index < periods.length; index++) ...[
          _ScheduleRow(period: periods[index], badge: badges[index]),
          if (index < periods.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.period, required this.badge});

  final SchedulePeriod period;
  final PeriodBadge? badge;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'P',
                  style: TextStyle(
                    fontSize: 9,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${period.periodNumber}',
                  style: const TextStyle(
                    fontSize: 16,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Class ${period.className}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  period.startTime != null && period.endTime != null
                      ? '${period.subjectName} · ${period.startTime} – ${period.endTime}'
                      : period.subjectName,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          if (badge == PeriodBadge.now)
            const StatusChip(label: 'Now', color: AppColors.success, tint: AppColors.successSoft)
          else if (badge == PeriodBadge.upcoming)
            const StatusChip(label: 'Upcoming', color: AppColors.primary, tint: AppColors.primarySoft),
        ],
      ),
    );
  }
}

/// Per-class attendance for today — the web's "Your Class Attendance" chart
/// as a list of bars, which reads better at phone width.
class _ClassAttendanceCard extends StatelessWidget {
  const _ClassAttendanceCard({required this.classes});

  final List<ClassAttendance> classes;

  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.bar_chart_rounded,
          title: 'No classes assigned',
          message: 'Classes you teach will show their attendance here.',
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      child: Column(
        children: [
          for (var index = 0; index < classes.length; index++) ...[
            if (index > 0) const Divider(),
            _ClassAttendanceRow(item: classes[index]),
          ],
        ],
      ),
    );
  }
}

class _ClassAttendanceRow extends StatelessWidget {
  const _ClassAttendanceRow({required this.item});

  final ClassAttendance item;

  @override
  Widget build(BuildContext context) {
    final percent = item.attendancePercentage.clamp(0, 100);
    final color = percent >= 75
        ? AppColors.success
        : percent >= 60
            ? AppColors.warning
            : AppColors.danger;

    return InkWell(
      onTap: item.marked ? null : () => _open(context, const MarkAttendanceScreen()),
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
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                  ),
                ),
                if (item.marked)
                  Text(
                    '$percent%',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: color),
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
                  : '${item.totalStudents} students · tap to mark',
              style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// The web's "Today's Actions" (Marked / Unmarked / Homework) as one stacked
/// bar with the same three colours and a legend.
class _TodaysActionsCard extends StatelessWidget {
  const _TodaysActionsCard({required this.dashboard});

  final TeacherDashboard dashboard;

  static const _marked = Color(0xFF34C759);
  static const _unmarked = Color(0xFFFF9500);
  static const _homework = Color(0xFF7C3AED);

  @override
  Widget build(BuildContext context) {
    final segments = [
      (label: 'Marked', value: dashboard.markedClasses, color: _marked),
      (label: 'Unmarked', value: dashboard.overview.pendingAttendance, color: _unmarked),
      (label: 'Homework', value: dashboard.overview.pendingHomeworkSubmissions, color: _homework),
    ];
    final total = segments.fold<int>(0, (sum, segment) => sum + segment.value);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 12,
              child: total == 0
                  ? const ColoredBox(color: AppColors.background, child: SizedBox.expand())
                  : Row(
                      children: [
                        for (final segment in segments)
                          if (segment.value > 0)
                            Expanded(
                              flex: segment.value,
                              child: ColoredBox(color: segment.color),
                            ),
                      ],
                    ),
            ),
          ),
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
                            decoration: BoxDecoration(color: segment.color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              segment.label,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${segment.value}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
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

class _AlertsList extends StatelessWidget {
  const _AlertsList({required this.alerts});

  final List<DashboardAlert> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.verified_rounded,
          title: 'All caught up',
          message: 'Nothing needs your attention right now.',
        ),
      );
    }

    return Column(
      children: [
        for (var index = 0; index < alerts.length; index++) ...[
          if (index > 0) const SizedBox(height: 8),
          _AlertRow(alert: alerts[index]),
        ],
      ],
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.alert});

  final DashboardAlert alert;

  @override
  Widget build(BuildContext context) {
    final high = alert.severity == AlertSeverity.high;
    final color = high ? AppColors.danger : AppColors.warning;
    final tint = high ? AppColors.dangerSoft : AppColors.warningSoft;
    final Widget? target = switch (alert.type) {
      'ATTENDANCE_PENDING' => const MarkAttendanceScreen(),
      'HOMEWORK_PENDING' => const HomeworkScreen(),
      _ => null,
    };

    return AppCard(
      onTap: target == null ? null : () => _open(context, target),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(AppRadii.card)),
            child: Icon(
              high ? Icons.warning_amber_rounded : Icons.notifications_active_outlined,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              alert.message,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, height: 1.35),
            ),
          ),
          if (target != null)
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}
