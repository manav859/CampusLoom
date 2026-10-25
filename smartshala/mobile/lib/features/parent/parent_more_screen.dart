import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import 'data/parent_models.dart';
import 'data/parent_session.dart';
import 'parent_documents_screen.dart';
import 'parent_leave_screen.dart';
import 'widgets/child_avatar.dart';

/// The More tab: the selected child's identity, a link to their documents, a
/// child switcher when there is more than one, and sign out.
class ParentMoreScreen extends StatelessWidget {
  const ParentMoreScreen({super.key, required this.child});

  final ParentChild child;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<ParentSession>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        HomeSurface(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              ChildAvatar(child: child, size: 52),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.fullName,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    if (child.className != null) ...[
                      const SizedBox(height: 2),
                      Text(child.className!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                    if (child.admissionNumber != null) ...[
                      const SizedBox(height: 2),
                      Text('Adm. No. ${child.admissionNumber!}',
                          style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _Row(
          icon: Icons.description_rounded,
          color: AppColors.primary,
          title: 'Documents & Certificates',
          subtitle: 'Report cards and certificates',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ParentDocumentsScreen(childId: child.id, childName: child.fullName),
          )),
        ),
        const SizedBox(height: 10),
        _Row(
          icon: Icons.event_busy_rounded,
          color: AppColors.warning,
          title: 'Leave Requests',
          subtitle: 'Request and track leave',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ParentLeaveScreen(childId: child.id, childName: child.fullName),
          )),
        ),
        if (session.hasMultiple) ...[
          const SizedBox(height: 10),
          _Row(
            icon: Icons.swap_horiz_rounded,
            color: AppColors.teal,
            title: 'Switch student',
            subtitle: 'View another child',
            onTap: session.changeChild,
          ),
        ],
        const SizedBox(height: 10),
        _Row(
          icon: Icons.logout_rounded,
          color: AppColors.danger,
          title: 'Sign out',
          onTap: () => context.read<AuthController>().logout(),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.color, required this.title, this.subtitle, required this.onTap});

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HomeSurface(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: title == 'Sign out' ? AppColors.danger : AppColors.textPrimary,
                    )),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}
