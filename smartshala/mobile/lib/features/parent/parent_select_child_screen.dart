import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_session.dart';
import 'widgets/child_avatar.dart';

/// Shown after sign-in when a parent has more than one child: pick whose
/// dashboard to open. A parent with one child never sees this — the session
/// selects that child automatically.
class ParentSelectChildScreen extends StatelessWidget {
  const ParentSelectChildScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<ParentSession>();
    final children = session.children;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: children.isEmpty
            ? const EmptyView(
                icon: Icons.family_restroom_rounded,
                title: 'No children found',
                message: 'No student is linked to your mobile number. '
                    'Please contact your school office.',
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(24, 24, 24, 4),
                    child: Text(
                      'Select student',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(24, 0, 24, 8),
                    child: Text(
                      'Choose whose dashboard to open',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                    ),
                  ),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: children.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, index) => _ChildTile(
                        child: children[index],
                        onTap: () => session.select(children[index]),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _ChildTile extends StatelessWidget {
  const _ChildTile({required this.child, required this.onTap});

  final ParentChild child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = [
      if (child.className != null) child.className!,
      if (child.rollNumber != null) 'Roll No. ${child.rollNumber}',
    ];

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              ChildAvatar(child: child, size: 48),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.fullName,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    if (subtitleParts.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitleParts.join('  ·  '),
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
