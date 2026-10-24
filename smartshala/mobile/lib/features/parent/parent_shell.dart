import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_session.dart';
import 'parent_fees_screen.dart';
import 'parent_home_screen.dart';
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
            _ChildHeader(
              child: widget.child,
              onChange: session.hasMultiple ? session.changeChild : null,
            ),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: [
                  ParentHomeScreen(child: widget.child),
                  ParentFeesScreen(child: widget.child),
                  for (final tab in _tabs.skip(2))
                    EmptyView(
                      icon: tab.icon,
                      title: '${tab.label} coming soon',
                      message: 'The Parent app is being built phase by phase.',
                    ),
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

/// The selected child's identity, pinned above the tabs, with a way back to the
/// picker when there is more than one child.
class _ChildHeader extends StatelessWidget {
  const _ChildHeader({required this.child, this.onChange});

  final ParentChild child;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = [
      if (child.className != null) child.className!,
      if (child.rollNumber != null) 'Roll No. ${child.rollNumber}',
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          ChildAvatar(child: child, size: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.fullName,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                if (subtitleParts.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitleParts.join('  ·  '),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                  ),
                ],
              ],
            ),
          ),
          if (onChange != null)
            TextButton.icon(
              onPressed: onChange,
              icon: const Icon(Icons.swap_horiz_rounded, size: 18),
              label: const Text('Change'),
            ),
        ],
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
