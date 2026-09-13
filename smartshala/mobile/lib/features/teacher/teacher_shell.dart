import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import 'calendar/teacher_calendar_screen.dart';
import 'data/punch_controller.dart';
import 'data/teacher_models.dart';
import 'messages/teacher_messages_screen.dart';
import 'salary/salary_screen.dart';
import 'students/my_students_screen.dart';
import 'teacher_home_screen.dart';
import 'widgets/swipe_to_punch.dart';

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
        children: const [
          TeacherHomeScreen(),
          TeacherCalendarScreen(),
          MyStudentsScreen(),
          SalaryScreen(),
          TeacherMessagesScreen(),
        ],
      ),
      bottomNavigationBar: _BottomBar(
        index: _index,
        onChanged: (next) => setState(() => _index = next),
      ),
    );
  }
}

/// Punch bar + navigation, as one unit fixed to the bottom of every screen.
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: _PunchBar(),
            ),
            _NavRow(index: index, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}

class _PunchBar extends StatelessWidget {
  const _PunchBar();

  @override
  Widget build(BuildContext context) {
    final punch = context.watch<PunchController>();
    final state = punch.status.state;

    return SwipeToPunch(
      action: state == PunchState.notPunchedIn ? PunchAction.punchIn : PunchAction.punchOut,
      enabled: !punch.isLoading,
      busy: punch.isSubmitting,
      completedLabel: state == PunchState.punchedOut ? _completedLabel(punch.status) : null,
      onConfirmed: () async {
        final error = await context.read<PunchController>().punch();
        if (!context.mounted) return;

        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            backgroundColor: error == null ? AppColors.success : AppColors.danger,
            content: Text(error ?? _successMessage(context.read<PunchController>().status)),
          ),
        );
      },
    );
  }

  String _completedLabel(PunchStatus status) {
    final hours = status.workedMinutes ~/ 60;
    final minutes = status.workedMinutes % 60;
    return "Today's punch complete • ${hours}h ${minutes}m";
  }

  String _successMessage(PunchStatus status) => status.state == PunchState.punchedIn
      ? 'Punched in. Have a great day!'
      : 'Punched out. See you tomorrow!';
}

class _NavRow extends StatelessWidget {
  const _NavRow({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.calendar_month_rounded, label: 'Calendar'),
    (icon: Icons.groups_2_rounded, label: 'Students'),
    (icon: Icons.receipt_long_rounded, label: 'Salary'),
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
