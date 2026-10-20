import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config/feature_flags.dart';
import '../../core/push/push_message.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_back_button.dart';
import 'calendar/teacher_calendar_screen.dart';
import 'data/punch_controller.dart';
import 'messages/teacher_messages_screen.dart';
import 'salary/salary_screen.dart';
import 'students/my_students_screen.dart';
import 'teacher_home_screen.dart';

/// Messages is the last tab, so its index shifts when Pay Slip is hidden.
const int _messagesIndex = kPayrollEnabled ? 4 : 3;

class TeacherShell extends StatefulWidget {
  const TeacherShell({super.key});

  @override
  State<TeacherShell> createState() => _TeacherShellState();
}

class _TeacherShellState extends State<TeacherShell> {
  int _index = 0;
  PushService? _push;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PunchController>().load();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Nullable: the shells are pumped on their own in widget tests, where
    // nothing provides push. SmartShalaApp always does — session_providers_test
    // is what holds it to that.
    final push = context.read<PushService?>();
    if (push == _push) return;
    _push?.removeListener(_onPushTarget);
    _push = push?..addListener(_onPushTarget);
    // A notification tapped from a cold start is already waiting by the time
    // the shell exists.
    _onPushTarget();
  }

  /// Where a tapped notification lands. There is no Leave Approval screen in
  /// this app and the server never sends a teacher there; Messages, which
  /// carries their own leave requests, is the honest fallback.
  void _onPushTarget() {
    final target = _push?.takePendingTarget();
    if (target == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _index = switch (target) {
            PushTarget.home => 0,
            PushTarget.calendar => 1,
            PushTarget.messages || PushTarget.leaveApproval => _messagesIndex,
          });
    });
  }

  @override
  void dispose() {
    _push?.removeListener(_onPushTarget);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Home paints on white; the strip behind the docked swipe bar has to
      // match it or the page ends in a grey band.
      backgroundColor: Home.page,
      body: HomeTabScope(
        goHome: () => setState(() => _index = 0),
        child: IndexedStack(
          index: _index,
          children: [
            TeacherHomeScreen(onOpenMessages: () => setState(() => _index = _messagesIndex)),
            const TeacherCalendarScreen(),
            const MyStudentsScreen(),
            if (kPayrollEnabled) const SalaryScreen(),
            const TeacherMessagesScreen(),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Home only: every other tab is a list, and a swipe target over one
          // is too easy to catch while scrolling.
          if (_index == 0) const TeacherPunchSwipeBar(),
          _BottomBar(
            index: _index,
            onChanged: (next) => setState(() => _index = next),
          ),
        ],
      ),
    );
  }
}

/// Navigation fixed to the bottom of every screen. The punch control lives on
/// Home only, in the punch card at the top: a swipe target on every tab made it
/// too easy to punch out by accident while scrolling a list.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: _NavRow(index: index, onChanged: onChanged),
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  const _NavRow({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.calendar_month_rounded, label: 'Calendar'),
    (icon: Icons.groups_rounded, label: 'Students'),
    if (kPayrollEnabled) (icon: Icons.receipt_long_rounded, label: 'Pay Slip'),
    (icon: Icons.chat_bubble_outline_rounded, label: 'Messages'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4, top: 4),
      child: Row(
        children: List.generate(_items.length, (position) {
          final item = _items[position];
          final selected = position == index;
          final color = selected ? AppColors.primary : const Color(0xFF8C9AAF);

          return Expanded(
            child: InkWell(
              onTap: () => onChanged(position),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(item.icon, size: 24, color: color),
                    const SizedBox(height: 3),
                    Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 5),
                    // The selected tab carries a short bar under its label.
                    Container(
                      width: 22,
                      height: 2.5,
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
