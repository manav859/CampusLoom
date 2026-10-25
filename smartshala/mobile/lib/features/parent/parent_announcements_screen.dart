import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/data/messages_models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/announcement_card.dart';
import '../../core/widgets/announcement_detail_screen.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/app_chips.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';

/// The Messages tab: the school's announcements and the messages a teacher or
/// principal sent for this child, newest first in one feed. Read-only — there
/// is no parent account to track read state against, so every item just shows.
class ParentAnnouncementsScreen extends StatefulWidget {
  const ParentAnnouncementsScreen({super.key, required this.child});

  final ParentChild child;

  @override
  State<ParentAnnouncementsScreen> createState() => _ParentAnnouncementsScreenState();
}

class _ParentAnnouncementsScreenState extends State<ParentAnnouncementsScreen> {
  List<Announcement>? _announcements;
  List<ParentMessage>? _messages;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<ParentRepository>();
      final results = await Future.wait([
        repo.announcements(),
        repo.childMessages(widget.child.id),
      ]);
      if (!mounted) return;
      setState(() {
        _announcements = (results[0] as AnnouncementPage).items;
        _messages = results[1] as List<ParentMessage>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _open(Announcement announcement) {
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(announcement: announcement)),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    // One feed, newest first, however the two sources interleave.
    final entries = <_FeedEntry>[
      for (final a in _announcements!) _FeedEntry(a.publishedAt, announcement: a),
      for (final m in _messages!) _FeedEntry(m.sentAt, message: m),
    ]..sort((x, y) => y.date.compareTo(x.date));

    if (entries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            SizedBox(height: 100),
            EmptyView(
              icon: Icons.campaign_rounded,
              title: 'No messages yet',
              message: 'Announcements and messages from the school will appear here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: entries.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, index) {
          final entry = entries[index];
          final announcement = entry.announcement;
          if (announcement != null) {
            return AnnouncementCard(announcement: announcement, onTap: () => _open(announcement));
          }
          return _MessageCard(message: entry.message!);
        },
      ),
    );
  }
}

/// One row of the merged feed: either an announcement or a staff message, with
/// the timestamp the whole list sorts on.
class _FeedEntry {
  _FeedEntry(this.date, {this.announcement, this.message});

  final DateTime date;
  final Announcement? announcement;
  final ParentMessage? message;
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});

  final ParentMessage message;

  static final _dateFormat = DateFormat('d MMM yyyy, h:mm a');

  @override
  Widget build(BuildContext context) {
    return AppCard(
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
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.chat_bubble_rounded, size: 19, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      message.title,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _dateFormat.format(message.sentAt),
                      style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Text(
            message.body,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.45),
          ),
          const SizedBox(height: 12),
          StatusChip(
            label: 'From school',
            color: AppColors.textSecondary,
            tint: AppColors.background,
            icon: Icons.school_rounded,
          ),
        ],
      ),
    );
  }
}
