import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/push/push_message.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_back_button.dart';
import 'calendar/academic_calendar_screen.dart';
import 'leave/leave_approval_screen.dart';
import 'messages/principal_messages_screen.dart';
import 'principal_home_screen.dart';
import 'principal_more_screen.dart';
import 'quick_add_sheet.dart';

class PrincipalShell extends StatefulWidget {
  const PrincipalShell({super.key});

  @override
  State<PrincipalShell> createState() => _PrincipalShellState();
}

class _PrincipalShellState extends State<PrincipalShell> {
  int _index = 0;
  PushService? _push;

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
    // the shell exists, so the pending target is read here as well as on
    // every later change.
    _onPushTarget();
  }

  /// Where a tapped notification lands. Leave Approval is a pushed route rather
  /// than a tab, so it opens over Messages — which is where the shortcut to it
  /// lives anyway, and where the back button returns to.
  void _onPushTarget() {
    final target = _push?.takePendingTarget();
    if (target == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _index = switch (target) {
            PushTarget.home => 0,
            PushTarget.messages || PushTarget.leaveApproval => 1,
            PushTarget.calendar => 2,
          });
      if (target == PushTarget.leaveApproval) {
        Navigator.of(context).push<void>(
          MaterialPageRoute(builder: (_) => const LeaveApprovalScreen()),
        );
      }
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
      body: HomeTabScope(
        goHome: () => setState(() => _index = 0),
        child: IndexedStack(
          index: _index,
          children: [
            PrincipalHomeScreen(onOpenMessages: () => setState(() => _index = 1)),
            const PrincipalMessagesScreen(),
            const AcademicCalendarScreen(),
            const PrincipalMoreScreen(),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => QuickAddSheet.show(context),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: const CircleBorder(),
        child: const Icon(Icons.add_rounded, size: 30),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: _BottomBar(
        index: _index,
        onChanged: (next) => setState(() => _index = next),
      ),
    );
  }
}

/// Home · Messages · (+) · Calendar · More — the + sits in the notch, so the
/// row leaves a gap in the middle. Reports and Analytics live in More.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    // The page is white now, so the bar needs a shadow of its own to sit
    // above it. A border would cut straight across the centre notch.
    return BottomAppBar(
      color: AppColors.surface,
      elevation: 3,
      shadowColor: const Color(0x14123A6B),
      surfaceTintColor: Colors.transparent,
      height: 64,
      padding: EdgeInsets.zero,
      shape: const CircularNotchedRectangle(),
      notchMargin: 8,
      child: Row(
        children: [
          _NavItem(
            icon: Icons.home_rounded,
            label: 'Home',
            selected: index == 0,
            onTap: () => onChanged(0),
          ),
          _NavItem(
            icon: Icons.forum_rounded,
            label: 'Messages',
            selected: index == 1,
            onTap: () => onChanged(1),
          ),
          const SizedBox(width: 64),
          _NavItem(
            icon: Icons.calendar_month_rounded,
            label: 'Calendar',
            selected: index == 2,
            onTap: () => onChanged(2),
          ),
          _NavItem(
            icon: Icons.grid_view_rounded,
            label: 'More',
            selected: index == 3,
            onTap: () => onChanged(3),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.textMuted;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 23, color: color),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
