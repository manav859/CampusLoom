import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/messages_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/student_leave_models.dart';

/// Student Leave — the office side of the child-leave requests parents raise in
/// their app. Pending / Approved / Rejected tabs, with an Approve / Reject pair
/// on every pending card. Mirrors staff Leave Approval, keyed to the student.
class StudentLeaveApprovalScreen extends StatefulWidget {
  const StudentLeaveApprovalScreen({super.key});

  @override
  State<StudentLeaveApprovalScreen> createState() => _StudentLeaveApprovalScreenState();
}

class _StudentLeaveApprovalScreenState extends State<StudentLeaveApprovalScreen> {
  static const _tabs = [LeaveStatus.pending, LeaveStatus.approved, LeaveStatus.rejected];
  static const _pageSize = 20;

  int _tabIndex = 0;

  StudentLeavePage _page = StudentLeavePage.empty;
  StudentLeaveSummary _summary = StudentLeaveSummary.empty;

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
      final page = await context.read<PrincipalRepository>().studentLeave(status: _status, limit: _pageSize);
      if (!mounted) return;
      setState(() {
        _page = page;
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
      final next = await context.read<PrincipalRepository>().studentLeave(
            status: _status,
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
        ..showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _decide(StudentLeaveRequest request, {required bool approve}) async {
    final note = await _askForNote(approve: approve);
    if (note == null || !mounted) return;

    setState(() => _busyId = request.id);
    try {
      await context.read<PrincipalRepository>().decideStudentLeave(id: request.id, approve: approve, note: note);
      if (!mounted) return;

      // Reload: the decided row leaves this tab and every tile count moves.
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: approve ? AppColors.success : AppColors.danger,
            content: Text('${request.studentName}\'s leave ${approve ? 'approved' : 'rejected'}.'),
          ),
        );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
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
          decoration: const InputDecoration(labelText: 'Note (optional)', alignLabelWithHint: true),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            style: FilledButton.styleFrom(backgroundColor: approve ? AppColors.success : AppColors.danger),
            child: Text(approve ? 'Approve' : 'Reject'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Student Leave')),
      body: Column(
        children: [
          _SummaryRow(summary: _summary),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
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
        children: [const SizedBox(height: 80), ErrorView(message: _error!, onRetry: _load)],
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
              message: 'Nothing needs your attention in this tab.',
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
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Load More'),
              ),
            );
          }

          final request = _page.items[index];
          return _StudentLeaveCard(
            request: request,
            busy: _busyId == request.id,
            onApprove: () => _decide(request, approve: true),
            onReject: () => _decide(request, approve: false),
          );
        },
      ),
    );
  }
}

class _StudentLeaveCard extends StatelessWidget {
  const _StudentLeaveCard({
    required this.request,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final StudentLeaveRequest request;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  static final _dayFormat = DateFormat('d MMM yyyy');
  static final _appliedFormat = DateFormat('d MMM, h:mm a');

  String get _range {
    final from = _dayFormat.format(request.fromDate);
    if (request.days == 1) return from;
    return '$from  →  ${_dayFormat.format(request.toDate)}';
  }

  String get _subtitle {
    final parts = <String>[
      if (request.className != null && request.className!.isNotEmpty) request.className!,
      if (request.rollNumber != null) 'Roll ${request.rollNumber}',
    ];
    return parts.join(' • ');
  }

  @override
  Widget build(BuildContext context) {
    final pending = request.status == LeaveStatus.pending;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  _initials(request.studentName),
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      request.studentName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.25,
                      ),
                    ),
                    if (_subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(_subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(label: request.status.label, color: request.status.color, tint: request.status.tint),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.date_range_rounded, size: 15, color: AppColors.textMuted),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  _range,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
              ),
              Text(
                '${request.days}d',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(request.reason, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
          const SizedBox(height: 10),
          Text(
            'Raised by ${request.requestedByName ?? 'parent'} • ${_appliedFormat.format(request.appliedOn)}',
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
          if (!pending && request.decidedByName != null) ...[
            const SizedBox(height: 3),
            Text(
              '${request.status.label} by ${request.decidedByName}',
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
          if (request.decisionNote != null && request.decisionNote!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10)),
              child: Text(
                request.decisionNote!,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.35),
              ),
            ),
          ],
          if (pending) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : onReject,
                    icon: const Icon(Icons.close_rounded, size: 17),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: busy ? null : onApprove,
                    icon: const Icon(Icons.check_rounded, size: 17),
                    label: const Text('Approve'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.success,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary});

  final StudentLeaveSummary summary;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      (value: summary.total, label: 'Total', icon: Icons.inbox_rounded, color: AppColors.primary),
      (value: summary.pending, label: 'Pending', icon: Icons.hourglass_bottom_rounded, color: AppColors.warning),
      (value: summary.approved, label: 'Approved', icon: Icons.check_circle_rounded, color: AppColors.success),
      (value: summary.rejected, label: 'Rejected', icon: Icons.cancel_rounded, color: AppColors.danger),
    ];

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
