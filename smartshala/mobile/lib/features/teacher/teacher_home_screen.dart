import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/app_user.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/data/messages_repository.dart';
import '../../core/data/unread_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/brand_header.dart';
import '../../core/widgets/responsive.dart';
import '../../core/widgets/state_views.dart';
import 'attendance/mark_attendance_screen.dart';
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
/// and prints the same numbers, but it is laid out as a phone home screen
/// rather than a port of the web page: no app bar, the brand and the greeting
/// scroll with the content, and every section is a rounded, shadowed card.
class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key, this.onOpenMessages});

  /// Opens the Messages tab; the bell calls it.
  final VoidCallback? onOpenMessages;

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
    final messages = context.read<MessagesRepository>();
    final results = await Future.wait([
      repository.dashboard(),
      repository.todaySchedule(),
      // Only the unread count is needed for the bell.
      messages.announcements(limit: 1).then((page) => page.unreadCount, onError: (Object _) => 0),
    ]);

    if (mounted) context.read<UnreadController>().setCount(results[2] as int);
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
      backgroundColor: Home.page,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: FutureBuilder<_HomeData>(
            future: _future,
            builder: (context, snapshot) {
              final error = snapshot.error;
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
                children: [
                  _BrandRow(
                    notificationCount: context.watch<UnreadController>().count,
                    onNotificationsTap: widget.onOpenMessages,
                  ),
                  const SizedBox(height: 18),
                  const _Greeting(),
                  const SizedBox(height: 16),
                  // Above the dashboard's own loading and error states:
                  // punching must work while the rest is still loading, or
                  // when it could not load at all.
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
      ),
    );
  }
}

/// The home screen's own palette and shapes. The brand blue still comes from
/// [AppColors]; the pastel grounds below belong to this screen, one per metric
/// and one per quick action, so a tile is recognised by colour before it is read.
class Home {
  static const page = Color(0xFFFFFFFF);
  static const ink = Color(0xFF12284C);
  static const inkSoft = Color(0xFF5E7290);
  static const inkMuted = Color(0xFF8C9AAF);
  static const line = Color(0xFFEBEFF5);

  static const green = Color(0xFF17A05C);
  static const greenSoft = Color(0xFFDDF5E7);
  static const amber = Color(0xFFF5A623);
  static const amberInk = Color(0xFFB95A00);
  static const amberSoft = Color(0xFFFEF1DE);
  static const blueSoft = Color(0xFFE4EFFC);

  static const cardRadius = 14.0;
  static const tileRadius = 16.0;

  static const shadow = [
    BoxShadow(color: Color(0x0D123A6B), blurRadius: 14, offset: Offset(0, 4)),
  ];
}

/// White, softly shadowed, rounded surface — every section row on Home.
class _Surface extends StatelessWidget {
  const _Surface({required this.child, this.padding, this.onTap});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(Home.cardRadius);

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: shape, boxShadow: Home.shadow),
      child: Material(
        color: AppColors.surface,
        borderRadius: shape,
        child: InkWell(
          onTap: onTap,
          borderRadius: shape,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: shape,
              border: Border.all(color: Home.line),
            ),
            child: Padding(padding: padding ?? const EdgeInsets.all(14), child: child),
          ),
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

/// The logo and wordmark that replace the app bar, with the bell beside them.
/// The product already knows which app it is, so nothing here says "Teacher".
class _BrandRow extends StatelessWidget {
  const _BrandRow({required this.notificationCount, this.onNotificationsTap});

  final int notificationCount;
  final VoidCallback? onNotificationsTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const BrandLogo(size: 38),
        const SizedBox(width: 10),
        const Expanded(
          child: Text(
            'SmartShala',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: Home.ink,
              letterSpacing: -0.3,
            ),
          ),
        ),
        // The screens the tile grid has no room for — My Timetable, Change
        // Password, Sign out — are all behind this.
        _HeaderButton(
          icon: Icons.more_vert_rounded,
          tooltip: 'More',
          onTap: () => TeacherMoreSheet.show(context),
        ),
        _HeaderButton(
          icon: Icons.notifications_none_rounded,
          tooltip: 'Notifications',
          onTap: onNotificationsTap,
          dot: notificationCount > 0,
        ),
      ],
    );
  }
}

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({required this.icon, required this.tooltip, this.onTap, this.dot = false});

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(icon, size: 25, color: Home.ink),
              if (dot)
                Positioned(
                  right: 1,
                  top: 0,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF2374A),
                      shape: BoxShape.circle,
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

class _Greeting extends StatelessWidget {
  const _Greeting();

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthController, AppUser?>((auth) => auth.user);
    final greeting = switch (DateTime.now().hour) {
      < 12 => 'Good Morning,',
      < 17 => 'Good Afternoon,',
      _ => 'Good Evening,',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          greeting,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Home.ink, height: 1.3),
        ),
        Text(
          user?.fullName ?? 'Teacher',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: Home.ink, height: 1.3),
        ),
        const SizedBox(height: 2),
        const Text(
          "Let's make today productive!",
          style: TextStyle(fontSize: 13, color: Home.inkMuted, height: 1.3),
        ),
      ],
    );
  }
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
        _KpiGrid(overview: dashboard.overview),
        const SizedBox(height: 24),
        const _SectionHeader(title: 'Quick Actions'),
        const _QuickActionsGrid(),
        const SizedBox(height: 24),
        _SectionHeader(
          title: "Today's Schedule",
          onViewAll: () => _open(context, const MyTimetableScreen()),
        ),
        _ScheduleList(periods: data.schedule),
        const SizedBox(height: 24),
        _SectionHeader(
          title: 'Class Attendance',
          onViewAll: () => _open(context, const MarkAttendanceScreen()),
        ),
        _ClassAttendanceList(
          classes: dashboard.attendance,
          onMark: () => _open(context, const MarkAttendanceScreen()),
        ),
        const SizedBox(height: 24),
        const _SectionHeader(title: 'Alerts'),
        _AlertList(
          alerts: dashboard.actionAlerts,
          onTap: (alert) => switch (alert.kind) {
            ActionKind.attendancePending => () => _open(context, const MarkAttendanceScreen()),
            ActionKind.homeworkPending => () => _open(context, const HomeworkScreen()),
            _ => null,
          },
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.onViewAll});

  final String title;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Home.ink),
            ),
          ),
          if (onViewAll != null)
            InkWell(
              onTap: onViewAll,
              borderRadius: BorderRadius.circular(8),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'View all',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                    ),
                    Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.primary),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The four metrics, two across, each on its own pastel ground and each
/// opening the screen it counts.
class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.overview});

  final TeacherOverview overview;

  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        label: 'Assigned Students',
        value: overview.assignedStudents,
        icon: Icons.groups_rounded,
        ground: const Color(0xFFF4EBFE),
        accent: const Color(0xFF9B5FE8),
        screen: const MyStudentsScreen() as Widget,
      ),
      (
        label: 'Pending Attendance',
        value: overview.pendingAttendance,
        icon: Icons.calendar_month_rounded,
        ground: const Color(0xFFE7F2FD),
        accent: const Color(0xFF4A9BE8),
        screen: const MarkAttendanceScreen() as Widget,
      ),
      (
        label: 'Pending Homework',
        value: overview.pendingHomeworkSubmissions,
        icon: Icons.menu_book_rounded,
        ground: const Color(0xFFFEF1E6),
        accent: const Color(0xFFF59A52),
        screen: const HomeworkScreen() as Widget,
      ),
      (
        label: 'Assigned Classes',
        value: overview.assignedClasses,
        icon: Icons.co_present_rounded,
        ground: const Color(0xFFE9F7EC),
        accent: const Color(0xFF56C078),
        screen: const MyStudentsScreen() as Widget,
      ),
    ];

    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 4,
      spacing: 12,
      children: [
        for (final card in cards)
          _KpiTile(
            label: card.label,
            value: '${card.value}',
            icon: card.icon,
            ground: card.ground,
            accent: card.accent,
            onTap: () => _open(context, card.screen),
          ),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.ground,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color ground;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(Home.tileRadius);

    return Material(
      color: ground,
      borderRadius: shape,
      child: InkWell(
        onTap: onTap,
        borderRadius: shape,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(13, 13, 11, 11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 8),
                  // One line next to the icon on a normal phone; it wraps
                  // rather than clips when the font is scaled up.
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: Home.inkSoft,
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        value,
                        maxLines: 1,
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w700,
                          color: Home.ink,
                          height: 1.1,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 20, color: accent),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid();

  @override
  Widget build(BuildContext context) {
    final actions = [
      (
        icon: Icons.groups_rounded,
        title: 'Mark Attendance',
        chip: const Color(0xFFE4EFFC),
        accent: const Color(0xFF3B82E8),
        screen: const MarkAttendanceScreen() as Widget,
      ),
      (
        icon: Icons.menu_book_rounded,
        title: 'Homework',
        chip: const Color(0xFFF1E8FD),
        accent: const Color(0xFF8B5CF6),
        screen: const HomeworkScreen() as Widget,
      ),
      (
        icon: Icons.description_outlined,
        title: 'Enter Marks',
        chip: const Color(0xFFDFF4EF),
        accent: const Color(0xFF2DB89A),
        screen: const MarksScreen() as Widget,
      ),
      (
        icon: Icons.person_outline_rounded,
        title: 'My Students',
        chip: const Color(0xFFFDE5EC),
        accent: const Color(0xFFEC6E9B),
        screen: const MyStudentsScreen() as Widget,
      ),
      (
        icon: Icons.beach_access_rounded,
        title: 'Apply Leave',
        chip: const Color(0xFFFEF1DE),
        accent: const Color(0xFFF5A623),
        screen: const ApplyLeaveScreen() as Widget,
      ),
      (
        icon: Icons.track_changes_rounded,
        title: 'Students Needing Focus',
        chip: const Color(0xFFEFE7FD),
        accent: const Color(0xFF8B5CF6),
        screen: const StudentsNeedingFocusScreen() as Widget,
      ),
    ];

    return ResponsiveGrid(
      phoneColumns: 3,
      wideColumns: 6,
      spacing: 11,
      children: [
        for (final action in actions)
          _QuickAction(
            icon: action.icon,
            title: action.title,
            chip: action.chip,
            accent: action.accent,
            onTap: () => _open(context, action.screen),
          ),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.chip,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final Color chip;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _Surface(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: chip, shape: BoxShape.circle),
            child: Icon(icon, size: 21, color: accent),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Home.ink,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

/// Today's punch: the running total on the left, the day's three stamps on the
/// right, and whichever secondary control the current state offers. The swipe
/// that changes it is docked above the navigation, within thumb reach.
class _PunchCard extends StatelessWidget {
  const _PunchCard();

  @override
  Widget build(BuildContext context) {
    final punch = context.watch<PunchController>();
    final status = punch.status;
    final timeFormat = DateFormat('h:mm a');

    final (label, color, tint) = switch (status.state) {
      PunchState.notPunchedIn => ('Not Punched In', Home.amberInk, Home.amberSoft),
      PunchState.punchedIn => ('Punched In', Home.green, Home.greenSoft),
      PunchState.onBreak => ('On Break', Home.amberInk, Home.amberSoft),
      PunchState.punchedOut => ('Punched Out', AppColors.primary, Home.blueSoft),
    };

    final stamps = [
      ('Punch In', status.punchInAt == null ? '—' : timeFormat.format(status.punchInAt!)),
      ('Break', status.breakMinutes == 0 ? '—' : _duration(Duration(minutes: status.breakMinutes))),
      ('Punch Out', status.punchOutAt == null ? '—' : timeFormat.format(status.punchOutAt!)),
    ];

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFEDF3FE),
        borderRadius: BorderRadius.circular(Home.tileRadius),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: 62,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // The title and its status have to share one line with
                      // the clock, so both shrink before either wraps.
                      Row(
                        children: [
                          Container(
                            width: 31,
                            height: 31,
                            decoration: const BoxDecoration(
                              color: Color(0xFFDBE7FC),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.schedule_rounded, size: 17, color: AppColors.primary),
                          ),
                          const SizedBox(width: 8),
                          const Flexible(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                "Today's Punch",
                                maxLines: 1,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Home.ink),
                              ),
                            ),
                          ),
                          if (!punch.isLoading) ...[
                            const SizedBox(width: 6),
                            Flexible(
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: _Pill(label: label, color: color, tint: tint),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (punch.isLoading)
                        const _TimerText(text: '--:--:--')
                      else
                        _PunchTimer(status: status),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                const VerticalDivider(width: 1, thickness: 1, color: Color(0xFFD7E3F8)),
                const SizedBox(width: 12),
                Expanded(
                  flex: 38,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var index = 0; index < stamps.length; index++) ...[
                        if (index > 0)
                          const Divider(height: 13, thickness: 1, color: Color(0xFFD7E3F8)),
                        // Both halves are tight so neither can push the other
                        // out of the column when the system font is scaled up.
                        Row(
                          children: [
                            Expanded(
                              flex: 5,
                              child: Text(
                                stamps[index].$1,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 11.5, color: Home.inkSoft),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              flex: 4,
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerRight,
                                child: Text(
                                  punch.isLoading ? '…' : stamps[index].$2,
                                  maxLines: 1,
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: Home.ink,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          _PunchActions(punch: punch),
        ],
      ),
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
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(20)),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: color),
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
/// on a break it says so in place of "Worked today".
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _TimerText(text: text, dimmed: widget.status.state != PunchState.punchedIn),
        const SizedBox(height: 3),
        Text(
          onBreak ? 'On a break for ${_duration(widget.status.breakAt(now))} • timer paused' : 'Worked today',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: onBreak ? FontWeight.w600 : FontWeight.w400,
            color: onBreak ? Home.amberInk : Home.inkMuted,
            height: 1.3,
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
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: Text(
        text,
        maxLines: 1,
        style: TextStyle(
          fontSize: 29,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
          fontFeatures: const [FontFeature.tabularFigures()],
          color: dimmed ? Home.inkSoft : Home.ink,
        ),
      ),
    );
  }
}

/// The punch swipe, docked above the bottom navigation on Home rather than
/// sitting in the card. It stays within thumb reach however far the dashboard
/// is scrolled, and the shell shows it on Home only — a swipe target on every
/// tab made it too easy to punch out by accident while scrolling a list.
class TeacherPunchSwipeBar extends StatelessWidget {
  const TeacherPunchSwipeBar({super.key});

  @override
  Widget build(BuildContext context) {
    final punch = context.watch<PunchController>();

    final (action, step, label) = switch (punch.status.state) {
      PunchState.notPunchedIn => (PunchAction.punchIn, PunchStep.punchIn, null),
      PunchState.punchedIn => (PunchAction.punchOut, PunchStep.punchOut, null),
      PunchState.onBreak => (PunchAction.punchIn, PunchStep.punchIn, 'End Break'),
      PunchState.punchedOut => (PunchAction.punchIn, PunchStep.punchIn, 'Punch In Again'),
    };

    return Padding(
      // No panel behind it: the swipe is the only thing that should read as a
      // control down here, so it floats straight over the page.
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: SwipeToPunch(
        action: action,
        label: label,
        enabled: !punch.isLoading,
        busy: punch.isSubmitting,
        onConfirmed: () => _run(context, step),
      ),
    );
  }
}

/// What is left in the card once the swipe has moved out: the one secondary
/// control each state offers, or nothing at all.
class _PunchActions extends StatelessWidget {
  const _PunchActions({required this.punch});

  final PunchController punch;

  @override
  Widget build(BuildContext context) {
    final ready = !punch.isLoading && !punch.isSubmitting;

    final button = switch (punch.status.state) {
      PunchState.punchedIn => TextButton.icon(
          onPressed: ready ? () => _run(context, PunchStep.takeBreak) : null,
          icon: const Icon(Icons.free_breakfast_rounded, size: 16),
          label: const Text('Take a Break'),
          style: TextButton.styleFrom(
            foregroundColor: Home.amberInk,
            textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
          ),
        ),
      PunchState.onBreak => TextButton(
          onPressed: ready ? () => _confirmPunchOut(context) : null,
          style: TextButton.styleFrom(
            foregroundColor: Home.amberInk,
            textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
          ),
          child: const Text('Punch out for the day'),
        ),
      _ => null,
    };

    if (button == null) return const SizedBox.shrink();

    // A plain text control, not a slab: the reference card carries nothing
    // below the figures, so this stays as quiet as it can while remaining
    // the only way to start or end a break.
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Align(alignment: Alignment.centerLeft, child: button),
    );
  }
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

/// How the day's first punch-in gets its selfie. A test has no camera, and a
/// platform channel never answers one, so this is the seam they replace.
@visibleForTesting
Future<String?> Function() capturePunchSelfie = _captureSelfieFromCamera;

/// A cancelled, denied or broken camera still punches the teacher in — the
/// record is simply stored without a selfie, and the principal's dashboard
/// shows it as having none. Locking someone out of their own attendance over
/// a camera is the worse failure.
Future<String?> _captureSelfieFromCamera() async {
  try {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      // A punch selfie is looked at on a dashboard, never printed.
      maxWidth: 1080,
      imageQuality: 70,
    );
    return shot?.path;
  } catch (_) {
    return null;
  }
}

Future<void> _run(BuildContext context, PunchStep step) async {
  final controller = context.read<PunchController>();

  // Only the day's first punch-in carries a selfie. Ending a break and
  // re-opening a day punched out by mistake are both punchIn too, and the
  // server ignores a selfie on either, so there is no point asking.
  final selfiePath = step == PunchStep.punchIn && controller.status.state == PunchState.notPunchedIn
      ? await capturePunchSelfie()
      : null;
  if (!context.mounted) return;

  final error = await controller.run(step, selfiePath: selfiePath);
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
    // "In Class" and "Next Class" move with the clock, so the list repaints
    // each minute.
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
      return const _Surface(
        padding: EdgeInsets.symmetric(vertical: 26),
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
          if (index > 0) const SizedBox(height: 10),
          _ScheduleRow(period: periods[index], badge: badges[index]),
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
    final time = period.startTime != null && period.endTime != null
        ? '${period.startTime} – ${period.endTime}'
        : 'Period ${period.periodNumber}';

    return _Surface(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Home.cardRadius),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(width: 4, child: ColoredBox(color: AppColors.primary)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              time,
                              style: const TextStyle(fontSize: 12, color: Home.inkMuted),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              period.subjectName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Home.ink,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Class ${period.className} · Period ${period.periodNumber}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, color: Home.inkSoft),
                            ),
                          ],
                        ),
                      ),
                      if (badge == PeriodBadge.now) ...[
                        const SizedBox(width: 8),
                        const _Pill(label: 'In Class', color: Home.green, tint: Home.greenSoft),
                      ] else if (badge == PeriodBadge.upcoming) ...[
                        const SizedBox(width: 8),
                        const _Pill(label: 'Next Class', color: AppColors.primary, tint: Home.blueSoft),
                      ],
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

/// Today's attendance, one row per class: a ring of how much of the class is
/// present, the class, and the count. Any row opens the marking screen.
class _ClassAttendanceList extends StatelessWidget {
  const _ClassAttendanceList({required this.classes, required this.onMark});

  final List<ClassAttendance> classes;
  final VoidCallback onMark;

  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty) {
      return const _Surface(
        padding: EdgeInsets.symmetric(vertical: 26),
        child: EmptyView(
          icon: Icons.bar_chart_rounded,
          title: 'No classes assigned',
          message: 'Classes you teach will show their attendance here.',
        ),
      );
    }

    return Column(
      children: [
        for (var index = 0; index < classes.length; index++) ...[
          if (index > 0) const SizedBox(height: 10),
          _ClassAttendanceRow(item: classes[index], onMark: onMark),
        ],
      ],
    );
  }
}

class _ClassAttendanceRow extends StatelessWidget {
  const _ClassAttendanceRow({required this.item, required this.onMark});

  final ClassAttendance item;
  final VoidCallback onMark;

  @override
  Widget build(BuildContext context) {
    final percent = item.attendancePercentage.clamp(0, 100);
    final color = !item.marked
        ? Home.amber
        : percent >= 75
            ? Home.green
            : percent >= 60
                ? Home.amber
                : AppColors.danger;

    return _Surface(
      onTap: onMark,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              value: item.marked ? percent / 100 : 0,
              strokeWidth: 3.5,
              strokeCap: StrokeCap.round,
              color: color,
              backgroundColor: Home.line,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Class ${item.className}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Home.ink),
                ),
                const SizedBox(height: 2),
                Text(
                  item.marked
                      ? '${item.present} of ${item.totalStudents} present'
                      : 'Not marked · ${item.totalStudents} students',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: Home.inkSoft),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, size: 22, color: Home.inkMuted),
        ],
      ),
    );
  }
}

class _AlertList extends StatelessWidget {
  const _AlertList({required this.alerts, required this.onTap});

  final List<ActionAlert> alerts;
  final VoidCallback? Function(ActionAlert alert) onTap;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _Surface(
        padding: EdgeInsets.symmetric(vertical: 26),
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
          if (index > 0) const SizedBox(height: 10),
          _AlertRow(alert: alerts[index], onTap: onTap(alerts[index])),
        ],
      ],
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.alert, this.onTap});

  final ActionAlert alert;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (chip, accent) = alert.isDanger
        ? (const Color(0xFFFDE5E7), AppColors.danger)
        : (Home.amberSoft, Home.amber);

    return _Surface(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: chip, shape: BoxShape.circle),
            child: Icon(Icons.notifications_rounded, size: 17, color: accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              alert.label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: Home.ink, height: 1.35),
            ),
          ),
          const SizedBox(width: 6),
          const Icon(Icons.chevron_right_rounded, size: 20, color: Home.inkMuted),
        ],
      ),
    );
  }
}
