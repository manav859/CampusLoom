import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/push/push_message.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_session.dart';
import 'parent_announcements_screen.dart';
import 'parent_calendar_screen.dart';
import 'parent_fees_screen.dart';
import 'parent_home_screen.dart';
import 'parent_more_screen.dart';
import 'parent_select_child_screen.dart';
import 'widgets/child_avatar.dart';

/// Root of the Parent app after sign-in. Loads the parent's children, then
/// shows the Select Student picker (Phase 1) and, once a child is chosen, the
/// five-tab dashboard whose screens arrive in later phases.
class ParentShell extends StatefulWidget {
  const ParentShell({super.key});

  @override
  State<ParentShell> createState() => _ParentShellState();
}

class _ParentShellState extends State<ParentShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<ParentSession>();
      if (session.status == ParentLoadStatus.loading) session.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<ParentSession>();

    return switch (session.status) {
      ParentLoadStatus.loading => const Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(child: LoadingView()),
        ),
      ParentLoadStatus.error => Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            child: ErrorView(
              message: session.error ?? 'Could not load your children.',
              onRetry: session.load,
            ),
          ),
        ),
      ParentLoadStatus.ready =>
        session.selected == null ? const ParentSelectChildScreen() : _ParentHome(child: session.selected!),
    };
  }
}

/// The signed-in dashboard for one selected child. Tabs are placeholders until
/// each feature phase replaces them.
class _ParentHome extends StatefulWidget {
  const _ParentHome({required this.child});

  final ParentChild child;

  @override
  State<_ParentHome> createState() => _ParentHomeState();
}

class _ParentHomeState extends State<_ParentHome> {
  int _index = 0;
  PushService? _push;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Nullable: the shell is pumped on its own in widget tests, where nothing
    // provides push. SmartShalaApp always does in the real app.
    final push = context.read<PushService?>();
    if (push == _push) return;
    _push?.removeListener(_onPushTarget);
    _push = push?..addListener(_onPushTarget);
    // A notification tapped from a cold start is already waiting by the time
    // this shell exists, so the pending target is read here too, not only on
    // later changes.
    _onPushTarget();
  }

  /// Where a tapped parent notification lands. Announcements open Messages;
  /// absences, homework and results all hang off the child's dashboard, so they
  /// open Home. A target this app has no tab for (e.g. leave approval) falls
  /// back to Messages, as on the staff apps.
  void _onPushTarget() {
    final target = _push?.takePendingTarget();
    if (target == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _index = switch (target) {
            PushTarget.home => 0,
            PushTarget.calendar => 2,
            PushTarget.messages || PushTarget.leaveApproval => 3,
          });
    });
  }

  @override
  void dispose() {
    _push?.removeListener(_onPushTarget);
    super.dispose();
  }

  static const _tabs = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.account_balance_wallet_rounded, label: 'Fees'),
    (icon: Icons.calendar_month_rounded, label: 'Calendar'),
    (icon: Icons.chat_bubble_outline_rounded, label: 'Messages'),
    (icon: Icons.menu_rounded, label: 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    final session = context.read<ParentSession>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Home carries its own brand row, greeting and student card, laid
            // out as the reference home screen; the other tabs keep the compact
            // child bar pinned above them for context.
            if (_index != 0)
              _TabHeader(
                title: _tabs[_index].label,
                child: widget.child,
                onChange: session.hasMultiple ? session.changeChild : null,
              ),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: [
                  ParentHomeScreen(
                    child: widget.child,
                    onChangeChild: session.hasMultiple ? session.changeChild : null,
                    onSelectTab: (next) => setState(() => _index = next),
                  ),
                  ParentFeesScreen(child: widget.child),
                  const ParentCalendarScreen(),
                  const ParentAnnouncementsScreen(),
                  ParentMoreScreen(child: widget.child),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _BottomBar(
        index: _index,
        onChanged: (next) => setState(() => _index = next),
      ),
    );
  }
}

/// The header pinned above the non-Home tabs: the tab's name on the left, and a
/// compact chip for the child in view on the right — tappable to switch when the
/// parent has more than one child. Home carries its own brand row instead, so
/// the child's name is no longer stranded in a plain bar.
class _TabHeader extends StatelessWidget {
  const _TabHeader({required this.title, required this.child, this.onChange});

  final String title;
  final ParentChild child;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // No bar behind it — the title and the child chip sit straight on the
      // page so the tab reads as its content, not a stacked app bar.
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
          ),
          _ChildChip(child: child, onChange: onChange),
        ],
      ),
    );
  }
}

/// Avatar and first name on a soft blue pill, with a swap glyph when the child
/// can be switched.
class _ChildChip extends StatelessWidget {
  const _ChildChip({required this.child, this.onChange});

  final ParentChild child;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    final firstName = child.fullName.trim().split(RegExp(r'\s+')).first;
    final shape = BorderRadius.circular(22);

    return Material(
      color: AppColors.primarySoft,
      borderRadius: shape,
      child: InkWell(
        onTap: onChange,
        borderRadius: shape,
        child: Padding(
          padding: EdgeInsets.fromLTRB(6, 5, onChange != null ? 10 : 12, 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ChildAvatar(child: child, size: 26),
              const SizedBox(width: 8),
              Text(
                firstName,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primaryDark),
              ),
              if (onChange != null) ...[
                const SizedBox(width: 6),
                const Icon(Icons.swap_horiz_rounded, size: 16, color: AppColors.primary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Navigation fixed to the bottom of every screen — the same structure as the
/// Teacher app's bar.
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
        child: Padding(
          padding: const EdgeInsets.only(bottom: 4, top: 4),
          child: Row(
            children: List.generate(_ParentHomeState._tabs.length, (position) {
              final item = _ParentHomeState._tabs[position];
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
        ),
      ),
    );
  }
}
