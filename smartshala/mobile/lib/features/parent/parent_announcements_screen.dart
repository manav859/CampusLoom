import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/data/messages_models.dart';
import '../../core/widgets/announcement_card.dart';
import '../../core/widgets/announcement_detail_screen.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_repository.dart';

/// The Messages tab: the school's announcements for parents, newest first.
/// Read-only — there is no parent account to track read state against, so every
/// notice simply shows.
class ParentAnnouncementsScreen extends StatefulWidget {
  const ParentAnnouncementsScreen({super.key});

  @override
  State<ParentAnnouncementsScreen> createState() => _ParentAnnouncementsScreenState();
}

class _ParentAnnouncementsScreenState extends State<ParentAnnouncementsScreen> {
  List<Announcement>? _data;
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
      final page = await context.read<ParentRepository>().announcements();
      if (!mounted) return;
      setState(() {
        _data = page.items;
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

    final items = _data!;
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            SizedBox(height: 100),
            EmptyView(
              icon: Icons.campaign_rounded,
              title: 'No announcements yet',
              message: 'School announcements will appear here as they are posted.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => AnnouncementCard(announcement: items[i], onTap: () => _open(items[i])),
      ),
    );
  }
}
