import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';

/// Root of the Parent app after sign-in. Phase 0 scaffolding: the five tabs
/// from the design — Home · Fees · Calendar · Messages · More — are in place as
/// placeholders. Each later phase replaces one placeholder with its real
/// screen, the way the Teacher app was built.
class ParentShell extends StatefulWidget {
  const ParentShell({super.key});

  @override
  State<ParentShell> createState() => _ParentShellState();
}

class _ParentShellState extends State<ParentShell> {
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
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _index,
          children: [
            for (final tab in _tabs)
              EmptyView(
                icon: tab.icon,
                title: '${tab.label} coming soon',
                message: 'The Parent app is being built phase by phase.',
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
            children: List.generate(_ParentShellState._tabs.length, (position) {
              final item = _ParentShellState._tabs[position];
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
