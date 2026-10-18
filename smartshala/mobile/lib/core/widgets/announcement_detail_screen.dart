import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/messages_models.dart';
import '../theme/app_colors.dart';
import 'app_back_button.dart';
import 'app_chips.dart';

/// One announcement, opened from the Messages list. The list shows the first
/// few lines; this is where the whole notice is read, so nothing is clipped
/// and a long notice scrolls on its own instead of pushing the feed about.
class AnnouncementDetailScreen extends StatelessWidget {
  const AnnouncementDetailScreen({super.key, required this.announcement});

  final Announcement announcement;

  static final _dateFormat = DateFormat('d MMM yyyy, h:mm a');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Announcement'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Row(
            children: [
              if (announcement.priority != AnnouncementPriority.normal) ...[
                StatusChip(
                  label: announcement.priority.label,
                  color: announcement.priority.color,
                  tint: announcement.priority.tint,
                  icon: Icons.priority_high_rounded,
                ),
                const SizedBox(width: 8),
              ],
              StatusChip(
                label: announcement.audience.label,
                color: AppColors.textSecondary,
                tint: AppColors.background,
                icon: Icons.groups_2_rounded,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            announcement.title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            announcement.postedByName == null
                ? _dateFormat.format(announcement.publishedAt)
                : '${_dateFormat.format(announcement.publishedAt)} · ${announcement.postedByName}',
            style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 18),
          SelectableText(
            announcement.body,
            style: const TextStyle(
              fontSize: 15,
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
