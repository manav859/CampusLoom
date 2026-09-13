import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/data/messages_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/announcement_card.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/leave_card.dart';
import '../../../core/widgets/state_views.dart';
import '../leave/apply_leave_screen.dart';

/// The teacher Messages tab: school announcements and the status of this
/// teacher's own leave requests, per the blueprint's All / Announcements /
/// Leave tabs.
class TeacherMessagesScreen extends StatefulWidget {
  const TeacherMessagesScreen({super.key});

  @override
  State<TeacherMessagesScreen> createState() => _TeacherMessagesScreenState();
}

enum _Tab { all, announcements, leave }

class _TeacherMessagesScreenState extends State<TeacherMessagesScreen> {
  _Tab _tab = _Tab.all;

  AnnouncementPage _announcements = AnnouncementPage.empty;
  LeavePage _leave = LeavePage.empty;
  final Set<String> _expanded = <String>{};

  bool _loading = true;
  String? _error;
  String? _busyLeaveId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Both feeds in parallel — one wait, not two. Switching tabs afterwards is
  /// a pure filter over what is already in memory, so it costs no network.
  Future<void> _load() async {
    if (!_loading) setState(() => _error = null);
    final repository = context.read<MessagesRepository>();

    try {
      final results = await Future.wait([repository.announcements(), repository.myLeave()]);
      if (!mounted) return;
      setState(() {
        _announcements = results[0] as AnnouncementPage;
        _leave = results[1] as LeavePage;
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

  Future<void> _refresh() => _load();

  /// Expanding an announcement is what "reading" it means. The badge updates
  /// straight away and the server call trails behind, so the tap never waits
  /// on the network.
  void _toggle(Announcement announcement) {
    final wasExpanded = _expanded.contains(announcement.id);

    setState(() {
      if (wasExpanded) {
        _expanded.remove(announcement.id);
        return;
      }
      _expanded.add(announcement.id);

      if (!announcement.isRead) {
        _announcements = AnnouncementPage(
          items: _announcements.items
              .map((item) => item.id == announcement.id ? item.asRead() : item)
              .toList(),
          total: _announcements.total,
          unreadCount:
              _announcements.unreadCount > 0 ? _announcements.unreadCount - 1 : 0,
          hasMore: _announcements.hasMore,
        );
      }
    });

    if (!wasExpanded && !announcement.isRead) {
      context
          .read<MessagesRepository>()
          .markAnnouncementRead(announcement.id)
          .catchError((Object _) {
        // A missed read receipt is not worth interrupting the teacher for; the
        // next refresh reconciles it.
      });
    }
  }

  Future<void> _withdraw(LeaveRequest request) async {
    setState(() => _busyLeaveId = request.id);
    try {
      await context.read<MessagesRepository>().withdrawLeave(request.id);
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Leave request withdrawn.')));
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _busyLeaveId = null);
    }
  }

  Future<void> _openApplyLeave() async {
    final applied = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ApplyLeaveScreen()),
    );
    if (applied == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          if (_announcements.unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: StatusChip(
                  label: '${_announcements.unreadCount} new',
                  color: AppColors.primary,
                  tint: AppColors.primarySoft,
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: SegmentedTabs(
              labels: const ['All', 'Announcements', 'Leave'],
              counts: [
                _announcements.items.length + _leave.items.length,
                _announcements.items.length,
                _leave.items.length,
              ],
              index: _Tab.values.indexOf(_tab),
              onChanged: (next) => setState(() => _tab = _Tab.values[next]),
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openApplyLeave,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.event_available_rounded),
        label: const Text('Apply Leave'),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading your messages…');

    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 100),
          ErrorView(message: _error!, onRetry: _refresh),
        ],
      );
    }

    final showAnnouncements = _tab != _Tab.leave;
    final showLeave = _tab != _Tab.announcements;

    final announcements = showAnnouncements ? _announcements.items : const <Announcement>[];
    final leave = showLeave ? _leave.items : const <LeaveRequest>[];

    if (announcements.isEmpty && leave.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          children: [
            const SizedBox(height: 100),
            EmptyView(
              icon: switch (_tab) {
                _Tab.leave => Icons.event_available_rounded,
                _ => Icons.campaign_rounded,
              },
              title: switch (_tab) {
                _Tab.leave => 'No leave requests',
                _Tab.announcements => 'No announcements yet',
                _Tab.all => 'Nothing here yet',
              },
              message: switch (_tab) {
                _Tab.leave => 'Tap "Apply Leave" to send a request to your principal.',
                _ => 'School announcements will appear here as they are posted.',
              },
            ),
          ],
        ),
      );
    }

    // Leave sits above announcements: a teacher opens this tab to check on a
    // pending request far more often than to re-read a notice.
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
        itemCount: leave.length + announcements.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index < leave.length) {
            final request = leave[index];
            return LeaveCard(
              request: request,
              busy: _busyLeaveId == request.id,
              onWithdraw: () => _withdraw(request),
            );
          }

          final announcement = announcements[index - leave.length];
          return AnnouncementCard(
            announcement: announcement,
            expanded: _expanded.contains(announcement.id),
            onTap: () => _toggle(announcement),
          );
        },
      ),
    );
  }
}
