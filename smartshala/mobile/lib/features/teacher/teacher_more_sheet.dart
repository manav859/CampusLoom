import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../auth/change_password_screen.dart';
import 'messages/teacher_messages_screen.dart';
import 'salary/salary_screen.dart';
import 'timetable/my_timetable_screen.dart';

/// What the Home "More" quick action opens: the teacher's screens that have
/// no tile of their own in the grid. Together with the grid it covers every
/// item on the web teacher sidebar.
class TeacherMoreSheet extends StatelessWidget {
  const TeacherMoreSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => const TeacherMoreSheet(),
      );

  static const _actions = [
    (
      icon: Icons.view_week_rounded,
      title: 'My Timetable',
      subtitle: 'Your periods for the whole week',
      color: AppColors.primary,
      screen: MyTimetableScreen.new,
    ),
    (
      icon: Icons.receipt_long_rounded,
      title: 'Salary Details',
      subtitle: 'Your pay and salary slips',
      color: AppColors.success,
      screen: SalaryScreen.new,
    ),
    (
      icon: Icons.forum_rounded,
      title: 'Messages',
      subtitle: 'Announcements and your leave requests',
      color: AppColors.purple,
      screen: TeacherMessagesScreen.new,
    ),
    (
      icon: Icons.lock_reset_rounded,
      title: 'Change Password',
      subtitle: 'Set a new password for your account',
      color: AppColors.textSecondary,
      screen: ChangePasswordScreen.new,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'More',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 18),
            for (final action in _actions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: action.color.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(action.icon, color: action.color, size: 21),
                ),
                title: Text(
                  action.title,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  action.subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                trailing:
                    const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                onTap: () {
                  final navigator = Navigator.of(context);
                  navigator.pop();
                  navigator.push(
                    MaterialPageRoute<void>(builder: (_) => action.screen()),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
