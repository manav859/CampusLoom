import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/data/messages_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/announcement_card.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../announcements/create_announcement_screen.dart';
import '../leave/leave_approval_screen.dart';

/// The principal Messages tab — the announcements the school has published,
/// plus a shortcut into Leave Approval, which is where staff messages that
/// need an answer actually live.
class PrincipalMessagesScreen extends StatefulWidget {
  const PrincipalMessagesScreen({super.key});

  @override
  State<PrincipalMessagesScreen> createState() => _PrincipalMessagesScreenState();
}

class _PrincipalMessagesScreenState extends State<PrincipalMessagesScreen> {
  AnnouncementPage _page = AnnouncementPage.empty;
  LeaveSummary _leaveSummary = LeaveSummary.empty;
  final Set<String> _expanded = <String>{};

  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repository = context.read<MessagesRepository>();

    try {
      // The pending-leave count is a single grouped query on the server, so
      // fetching it alongside the feed costs one parallel call, not a screen.
      final results = await Future.wait([
        repository.announcements(),
        repository.schoolLeave(status: LeaveStatus.pending, limit: 1),
      ]);
      if (!mounted) return;
      setState(() {
        _page = results[0] as AnnouncementPage;
        _leaveSummary = (results[1] as LeavePage).summary;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _openCreate() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const CreateAnnouncementScreen()),
    );
    if (created == true) await _load();
  }

  Future<void> _openLeaveApproval() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const LeaveApprovalScreen()),
    );
    await _load();
  }

  void _toggle(Announcement announcement) {
    setState(() {
      if (!_expanded.remove(announcement.id)) _expanded.add(announcement.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.campaign_rounded),
        label: const Text('Announce'),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading messages…');

    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 100),
          ErrorView(message: _error!, onRetry: _load),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          ListRowCard(
            icon: Icons.event_available_rounded,
            title: 'Leave Approval',
            subtitle: _leaveSummary.pending == 0
                ? 'Nothing waiting on you'
                : '${_leaveSummary.pending} request${_leaveSummary.pending == 1 ? '' : 's'} awaiting your decision',
            color: AppColors.warning,
            trailing: _leaveSummary.pending == 0
                ? null
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.warning,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_leaveSummary.pending}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
            onTap: _openLeaveApproval,
          ),
          const SizedBox(height: 22),
          SectionHeader(
            title: 'Announcements',
            action: Text(
              _page.total == 0 ? '' : '${_page.total} posted',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (_page.items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 30),
              child: EmptyView(
                icon: Icons.campaign_rounded,
                title: 'No announcements yet',
                message: 'Tap "Announce" to send a notice to your staff.',
              ),
            )
          else
            for (final announcement in _page.items) ...[
              AnnouncementCard(
                announcement: announcement,
                expanded: _expanded.contains(announcement.id),
                onTap: () => _toggle(announcement),
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}
