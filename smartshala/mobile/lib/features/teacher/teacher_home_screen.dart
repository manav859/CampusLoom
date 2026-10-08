import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/data/messages_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/app_chips.dart';
import '../../core/widgets/brand_header.dart';
import '../../core/widgets/dashboard_widgets.dart';
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
import 'teacher_more_sheet.dart';
import 'widgets/swipe_to_punch.dart';
import 'timetable/my_timetable_screen.dart';

/// The teacher dashboard. It reads the same endpoints as the web teacher
/// dashboard (GET /dashboard, /users/me/schedule, /staff-attendance/me/today)
/// and shows the same sections in the same order, so a number seen on one is
/// the number on the other. Greeting and Quick Actions are app-only: on the
/// web those jobs belong to the page title and the sidebar.
class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key, this.onOpenMessages});

  /// Opens the Messages tab; the bell calls it.
  final VoidCallback? onOpenMessages;

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  late Future<_HomeData> _future;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final repository = context.read<TeacherRepository>();
    final messages = context.read<MessagesRepository>();
    final results = await Future.wait([
      repository.dashboard(),
      repository.todaySchedule(),
      // Only the unread count is needed for the bell.
      messages.announcements(limit: 1).then((page) => page.unreadCount, onError: (Object _) => 0),
    ]);

    if (mounted) setState(() => _unreadCount = results[2] as int);
    return _HomeData(
      dashboard: results[0] as TeacherDashboard,
      schedule: results[1] as List<SchedulePeriod>,
    );
  }

  Future<void> _refresh() async {
    final future = _load();
    setState(() { _future = future; });
    unawaited(context.read<PunchController>().load());
    await future.catchError((Object _) => _HomeData.empty);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BrandAppBar(
        portalLabel: 'TEACHER PORTAL',
        notificationCount: _unreadCount,
        onNotificationsTap: widget.onOpenMessages,
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_HomeData>(
          future: _future,
          builder: (context, snapshot) {
            final error = snapshot.error;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                // First on Home, and outside the dashboard's own loading and
                // error states: punching must work while the rest is still
                // loading, or when it could not load at all.
                const _PunchCard(),
                const SizedBox(height: 16),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: LoadingView(message: 'Loading your day…'),
                  )
                else if (snapshot.hasError)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: ErrorView(
                      message: error is ApiException ? error.message : 'Could not load your dashboard.',
                      onRetry: _refresh,
                    ),
                  )
                else
                  _HomeBody(data: snapshot.data ?? _HomeData.empty),
              ],
            );
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
        SectionHeader(
          title: "Today's Schedule",
          action: TextButton(
            onPressed: () => _open(context, const MyTimetableScreen()),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            child: const Text('View week'),
          ),
        ),
        _ScheduleList(periods: data.schedule),
        const SizedBox(height: 22),
        const SectionHeader(title: 'Your Class Attendance'),
        ClassAttendanceCard(
          classes: dashboard.attendance,
          onMark: () => _open(context, const MarkAttendanceScreen()),
        ),
        const SizedBox(height: 22),
        const SectionHeader(title: "Today's Actions"),
        // The web workload donut's segments and colours.
        SegmentBarCard(
          segments: [
            (label: 'Marked', value: dashboard.markedClasses, color: const Color(0xFF34C759)),
            (label: 'Unmarked', value: dashboard.overview.pendingAttendance, color: const Color(0xFFFF9500)),
            (label: 'Homework', value: dashboard.overview.pendingHomeworkSubmissions, color: const Color(0xFF7C3AED)),
          ],
        ),
        const SizedBox(height: 22),
        const SectionHeader(title: 'Alerts'),
        ActionAlertList(
          alerts: dashboard.actionAlerts,
          onTap: (alert) => switch (alert.kind) {
            ActionKind.attendancePending => () => _open(context, const MarkAttendanceScreen()),
            ActionKind.homeworkPending => () => _open(context, const HomeworkScreen()),
            _ => null,
          },
        ),
        const SizedBox(height: 28),
        // The teacher app has no More tab, so signing out lives at the end of Home.
        OutlinedButton.icon(
          onPressed: () => context.read<AuthController>().logout(),
          icon: const Icon(Icons.logout_rounded, size: 20),
          label: const Text('Sign out'),
        ),
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
              // Only More has no screen: it opens a sheet of the rest.
              onTap: action.screen == null
                  ? () => TeacherMoreSheet.show(context)
                  : () => _open(context, action.screen!),
            ),
          )
          .toList(),
    );
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
/// Today's punch, first thing on Home: a timer of time worked today that runs
/// while punched in and stops on a break or a punch-out, and the one control
/// that changes it. The day can be punched into again after a punch-out, so a
/// mistaken one is undone the same way it was made.
class _PunchCard extends StatelessWidget {
  const _PunchCard();

  @override
  Widget build(BuildContext context) {
    final punch = context.watch<PunchController>();
    final status = punch.status;
    final timeFormat = DateFormat('h:mm a');

    final (label, color, tint) = switch (status.state) {
      PunchState.notPunchedIn => ('Not punched in', AppColors.warning, AppColors.warningSoft),
      PunchState.punchedIn => ('Working', AppColors.success, AppColors.successSoft),
      PunchState.onBreak => ('On a break', AppColors.warning, AppColors.warningSoft),
      PunchState.punchedOut => ('Punched out', AppColors.primary, AppColors.primarySoft),
    };

    final figures = [
      ('First in', status.punchInAt == null ? '—' : timeFormat.format(status.punchInAt!)),
      ('Breaks', status.state == PunchState.notPunchedIn ? '—' : _duration(Duration(minutes: status.breakMinutes))),
      ('Punched out', status.punchOutAt == null ? '—' : timeFormat.format(status.punchOutAt!)),
    ];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  "Today's Punch",
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              if (!punch.isLoading) StatusChip(label: label, color: color, tint: tint),
            ],
          ),
          const SizedBox(height: 12),
          Center(child: punch.isLoading ? const _TimerText(text: '--:--:--') : _PunchTimer(status: status)),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var index = 0; index < figures.length; index++) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 6),
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
                              fontSize: 14,
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
          const SizedBox(height: 14),
          _PunchActions(punch: punch),
        ],
      ),
    );
  }
}

String _duration(Duration value) {
  final hours = value.inHours;
  final minutes = value.inMinutes % 60;
  return hours == 0 ? '${minutes}m' : '${hours}h ${minutes}m';
}

/// Worked time today as HH:MM:SS. It ticks each second only while punched in;
/// on a break it shows the break's own running time underneath.
class _PunchTimer extends StatefulWidget {
  const _PunchTimer({required this.status});

  final PunchStatus status;

  @override
  State<_PunchTimer> createState() => _PunchTimerState();
}

class _PunchTimerState extends State<_PunchTimer> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _PunchTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  /// Ticking costs a rebuild a second, so it runs only while something moves.
  void _sync() {
    final moving = widget.status.state == PunchState.punchedIn || widget.status.state == PunchState.onBreak;
    if (moving && _ticker == null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    } else if (!moving) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final worked = widget.status.workedAt(now);
    final onBreak = widget.status.state == PunchState.onBreak;
    String two(int value) => value.toString().padLeft(2, '0');
    final text = '${two(worked.inHours)}:${two(worked.inMinutes % 60)}:${two(worked.inSeconds % 60)}';

    return Column(
      children: [
        _TimerText(text: text, dimmed: widget.status.state != PunchState.punchedIn),
        const SizedBox(height: 2),
        Text(
          onBreak ? 'On a break for ${_duration(widget.status.breakAt(now))} • timer paused' : 'Worked today',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: onBreak ? AppColors.warning : AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _TimerText extends StatelessWidget {
  const _TimerText({required this.text, this.dimmed = false});

  final String text;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        letterSpacing: 1,
        fontFeatures: const [FontFeature.tabularFigures()],
        color: dimmed ? AppColors.textSecondary : AppColors.textPrimary,
      ),
    );
  }
}

/// The controls for where the day stands. Punching in and out are swipes, so
/// a stray tap cannot do either; a break is a tap, because it is undone by the
/// swipe that ends it.
class _PunchActions extends StatelessWidget {
  const _PunchActions({required this.punch});

  final PunchController punch;

  @override
  Widget build(BuildContext context) {
    final state = punch.status.state;
    final enabled = !punch.isLoading;

    Widget swipe(PunchAction action, PunchStep step, {String? label}) => SwipeToPunch(
          action: action,
          label: label,
          enabled: enabled,
          busy: punch.isSubmitting,
          onConfirmed: () => _run(context, step),
        );

    return switch (state) {
      PunchState.notPunchedIn => swipe(PunchAction.punchIn, PunchStep.punchIn),
      PunchState.punchedIn => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            swipe(PunchAction.punchOut, PunchStep.punchOut),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: enabled && !punch.isSubmitting ? () => _run(context, PunchStep.takeBreak) : null,
              icon: const Icon(Icons.free_breakfast_rounded, size: 18),
              label: const Text('Take a Break'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.warning,
                side: const BorderSide(color: AppColors.warning),
                minimumSize: const Size.fromHeight(44),
              ),
            ),
          ],
        ),
      PunchState.onBreak => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            swipe(PunchAction.punchIn, PunchStep.punchIn, label: 'Swipe To End Break'),
            const SizedBox(height: 6),
            TextButton(
              onPressed: enabled && !punch.isSubmitting ? () => _confirmPunchOut(context) : null,
              child: const Text('Punch out for the day'),
            ),
          ],
        ),
      PunchState.punchedOut => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 10),
              child: Text(
                'Punched out by mistake, or back for more work? Punch in again — the timer carries on from where it stopped.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
              ),
            ),
            swipe(PunchAction.punchIn, PunchStep.punchIn, label: 'Swipe To Punch In Again'),
          ],
        ),
    };
  }

  /// From a break, punching out is a tap, so it asks first.
  Future<void> _confirmPunchOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Punch out for the day?'),
        content: const Text('Your break ends your working time for today. You can punch in again if you come back.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Punch out')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) await _run(context, PunchStep.punchOut);
  }

  Future<void> _run(BuildContext context, PunchStep step) async {
    final controller = context.read<PunchController>();
    final error = await controller.run(step);
    if (!context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: error == null ? AppColors.success : AppColors.danger,
        content: Text(error ?? _successMessage(step, controller.status)),
      ),
    );
  }

  String _successMessage(PunchStep step, PunchStatus status) => switch (step) {
        PunchStep.takeBreak => 'Break started. Your timer is paused.',
        PunchStep.punchOut => 'Punched out after ${_duration(status.workedAt(DateTime.now()))} of work. See you tomorrow!',
        PunchStep.punchIn => status.sessions.length > 1 ? 'Welcome back. Your timer is running again.' : 'Punched in. Have a great day!',
      };
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
