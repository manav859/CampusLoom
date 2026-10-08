import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import 'calendar/teacher_calendar_screen.dart';
import 'data/punch_controller.dart';
import 'messages/teacher_messages_screen.dart';
import 'salary/salary_screen.dart';
import 'students/my_students_screen.dart';
import 'teacher_home_screen.dart';

class TeacherShell extends StatefulWidget {
  const TeacherShell({super.key});

  @override
  State<TeacherShell> createState() => _TeacherShellState();
}

class _TeacherShellState extends State<TeacherShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PunchController>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          TeacherHomeScreen(onOpenMessages: () => setState(() => _index = 4)),
          const TeacherCalendarScreen(),
          const MyStudentsScreen(),
          const SalaryScreen(),
          const TeacherMessagesScreen(),
        ],
      ),
      bottomNavigationBar: _BottomBar(
        index: _index,
        onChanged: (next) => setState(() => _index = next),
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
    (icon: Icons.groups_2_rounded, label: 'Students'),
    (icon: Icons.receipt_long_rounded, label: 'Pay Slip'),
    (icon: Icons.notifications_none_rounded, label: 'Messages'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 2),
      child: Row(
        children: List.generate(_items.length, (position) {
          final item = _items[position];
          final selected = position == index;

          return Expanded(
            child: InkWell(
              onTap: () => onChanged(position),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      item.icon,
                      size: 24,
                      color: selected ? AppColors.primary : AppColors.textMuted,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? AppColors.primary : AppColors.textMuted,
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
