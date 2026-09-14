import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'announcements/create_announcement_screen.dart';
import 'calendar/event_form_screen.dart';
import 'classes/class_form_screen.dart';
import 'students/add_student_screen.dart';
import 'teachers/add_teacher_screen.dart';

/// The "+" creation menu. Per the blueprint the + button is reserved for
/// creation actions only — never for navigation.
class QuickAddSheet extends StatelessWidget {
  const QuickAddSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => const QuickAddSheet(),
      );

  static const _actions = [
    (
      icon: Icons.person_add_alt_1_rounded,
      title: 'Add Student',
      subtitle: 'Enrol a new student',
      color: AppColors.primary,
      screen: AddStudentScreen.new,
    ),
    (
      icon: Icons.badge_rounded,
      title: 'Add Teacher',
      subtitle: 'Add a teaching staff member',
      color: AppColors.success,
      screen: AddTeacherScreen.new,
    ),
    (
      icon: Icons.grid_view_rounded,
      title: 'Add Class / Section',
      subtitle: 'Create a new class or section',
      color: AppColors.teal,
      screen: ClassFormScreen.new,
    ),
    (
      icon: Icons.campaign_rounded,
      title: 'Create Announcement',
      subtitle: 'Notify staff and parents',
      color: AppColors.purple,
      screen: CreateAnnouncementScreen.new,
    ),
    (
      icon: Icons.event_rounded,
      title: 'Create Event / Notice',
      subtitle: 'Add to the academic calendar',
      color: AppColors.warning,
      screen: EventFormScreen.new,
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
              'Quick Add',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'What would you like to create?',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
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
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
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
