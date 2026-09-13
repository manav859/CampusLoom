import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          PrincipalHomeScreen(onOpenMessages: () => setState(() => _index = 2)),
          const _PendingTab(icon: Icons.insights_rounded, title: 'Reports', phase: 'Phase 6'),
          const PrincipalMessagesScreen(),
          const PrincipalMoreScreen(),
        ],
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

/// Home · Reports · (+) · Messages · More — the + sits in the notch, so the
/// row leaves a gap in the middle.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return BottomAppBar(
      color: AppColors.surface,
      elevation: 0,
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
            icon: Icons.bar_chart_rounded,
            label: 'Reports',
            selected: index == 1,
            onTap: () => onChanged(1),
          ),
          const SizedBox(width: 64),
          _NavItem(
            icon: Icons.forum_rounded,
            label: 'Messages',
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

class _PendingTab extends StatelessWidget {
  const _PendingTab({required this.icon, required this.title, required this.phase});

  final IconData icon;
  final String title;
  final String phase;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: EmptyView(
        icon: icon,
        title: title,
        message: 'Planned for $phase of the V2 rollout.',
      ),
    );
  }
}
