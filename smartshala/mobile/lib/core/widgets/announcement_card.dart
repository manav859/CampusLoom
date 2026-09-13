import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/messages_models.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';
import 'app_chips.dart';

/// One announcement. Collapsed to three lines until tapped, so a long notice
/// cannot push the rest of the feed off the screen.
class AnnouncementCard extends StatelessWidget {
  const AnnouncementCard({
    super.key,
    required this.announcement,
    required this.expanded,
    required this.onTap,
  });

  final Announcement announcement;
  final bool expanded;
  final VoidCallback onTap;

  static final _dateFormat = DateFormat('d MMM yyyy, h:mm a');

  @override
  Widget build(BuildContext context) {
    final unread = !announcement.isRead;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: announcement.priority.tint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.campaign_rounded,
                  size: 20,
                  color: announcement.priority.color,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      announcement.title,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: unread ? FontWeight.w800 : FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _dateFormat.format(announcement.publishedAt),
                      style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              if (unread) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 11),
          AnimatedSize(
            duration: const Duration(milliseconds: 160),
            alignment: Alignment.topCenter,
            curve: Curves.easeOut,
            child: Text(
              announcement.body,
              maxLines: expanded ? null : 3,
              overflow: expanded ? null : TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: 12),
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
              const Spacer(),
              if (announcement.postedByName != null)
                Flexible(
                  child: Text(
                    announcement.postedByName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
