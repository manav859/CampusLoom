import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/data/messages_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/leave_card.dart';
import '../../../core/widgets/state_views.dart';

/// Leave Approval — stat tiles, Pending / Approved / Rejected tabs, and the
/// Approve / Reject pair on every pending card.
class LeaveApprovalScreen extends StatefulWidget {
  const LeaveApprovalScreen({super.key});

  @override
  State<LeaveApprovalScreen> createState() => _LeaveApprovalScreenState();
}

class _LeaveApprovalScreenState extends State<LeaveApprovalScreen> {
  static const _tabs = [LeaveStatus.pending, LeaveStatus.approved, LeaveStatus.rejected];
  static const _pageSize = 20;

  int _tabIndex = 0;
  String _search = '';

  LeavePage _page = LeavePage.empty;
  LeaveSummary _summary = LeaveSummary.empty;

  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  LeaveStatus get _status => _tabs[_tabIndex];

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final page = await context.read<MessagesRepository>().schoolLeave(
            status: _status,
            search: _search,
            limit: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        _page = page;
        // The tiles describe the whole school and ride along with every
        // response, so they cannot drift out of step with the list.
        _summary = page.summary;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_page.hasMore) return;
    setState(() => _loadingMore = true);

    try {
      final next = await context.read<MessagesRepository>().schoolLeave(
            status: _status,
            search: _search,
            limit: _pageSize,
            offset: _page.items.length,
          );
      if (!mounted) return;
      setState(() {
        _page = _page.appending(next);
        _summary = next.summary;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _decide(LeaveRequest request, {required bool approve}) async {
    final note = await _askForNote(approve: approve);
    if (note == null || !mounted) return;

    setState(() => _busyId = request.id);
    try {
      await context.read<MessagesRepository>().decideLeave(
            id: request.id,
            approve: approve,
            note: note,
          );
      if (!mounted) return;

      // Reload rather than patch in place: the decided row leaves this tab and
      // every tile count moves, so a fresh page is the honest answer.
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: approve ? AppColors.success : AppColors.danger,
            content: Text(
              '${request.applicantName}\'s leave ${approve ? 'approved' : 'rejected'}.',
            ),
          ),
        );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  /// Returns the note, or null when the principal backs out. An empty string is
  /// a valid answer — it means "decide, no note".
  Future<String?> _askForNote({required bool approve}) {
    final controller = TextEditingController();

    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(approve ? 'Approve leave?' : 'Reject leave?'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 500,
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Note (optional)',
            alignLabelWithHint: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            style: FilledButton.styleFrom(
              backgroundColor: approve ? AppColors.success : AppColors.danger,
            ),
            child: Text(approve ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Approval')),
      body: Column(
        children: [
          _SummaryRow(summary: _summary),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: TextField(
              onSubmitted: (value) {
                setState(() => _search = value);
                _load();
              },
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(
                hintText: 'Search by teacher name...',
                prefixIcon:
                    Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SegmentedTabs(
              labels: const ['Pending', 'Approved', 'Rejected'],
              counts: [_summary.pending, _summary.approved, _summary.rejected],
              index: _tabIndex,
              onChanged: (next) {
                if (next == _tabIndex) return;
                setState(() => _tabIndex = next);
                _load();
              },
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading leave requests…');

    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          ErrorView(message: _error!, onRetry: _load),
        ],
      );
    }

    if (_page.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 80),
            EmptyView(
              icon: Icons.event_available_rounded,
              title: 'No ${_status.label.toLowerCase()} requests',
              message: _search.isEmpty
                  ? 'Nothing needs your attention in this tab.'
                  : 'No request matches "$_search".',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: _page.items.length + (_page.hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == _page.items.length) {
            return Padding(
              padding: const EdgeInsets.only(top: 6),
              child: OutlinedButton(
                onPressed: _loadingMore ? null : _loadMore,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _loadingMore
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2.2),
                      )
                    : const Text('Load More'),
              ),
            );
          }

          final request = _page.items[index];
          return LeaveCard(
            request: request,
            showApplicant: true,
            busy: _busyId == request.id,
            onApprove: () => _decide(request, approve: true),
            onReject: () => _decide(request, approve: false),
          );
        },
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary});

  final LeaveSummary summary;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      (value: summary.total, label: 'Total', icon: Icons.inbox_rounded, color: AppColors.primary),
      (
        value: summary.pending,
        label: 'Pending',
        icon: Icons.hourglass_bottom_rounded,
        color: AppColors.warning
      ),
      (
        value: summary.approved,
        label: 'Approved',
        icon: Icons.check_circle_rounded,
        color: AppColors.success
      ),
      (
        value: summary.rejected,
        label: 'Rejected',
        icon: Icons.cancel_rounded,
        color: AppColors.danger
      ),
    ];

    // Scrolls sideways rather than cramming four tiles across a narrow phone,
    // matching the teacher home overview row.
    return SizedBox(
      height: 132,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        clipBehavior: Clip.none,
        itemCount: tiles.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final tile = tiles[index];
          return SizedBox(
            width: 118,
            child: StatTile(
              value: tile.value.toString().padLeft(2, '0'),
              label: tile.label,
              icon: tile.icon,
              color: tile.color,
              borderRadius: 12,
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
            ),
          );
        },
      ),
    );
  }
}
