import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/messages_models.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';
import 'app_chips.dart';

/// One leave request, rendered the same way in both apps. The principal build
/// adds the applicant's name and the Approve / Reject pair; the teacher build
/// shows neither, because a teacher only ever sees their own requests.
class LeaveCard extends StatelessWidget {
  const LeaveCard({
    super.key,
    required this.request,
    this.showApplicant = false,
    this.onApprove,
    this.onReject,
    this.onWithdraw,
    this.busy = false,
  });

  final LeaveRequest request;
  final bool showApplicant;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;
  final VoidCallback? onWithdraw;
  final bool busy;

  static final _dayFormat = DateFormat('d MMM yyyy');
  static final _appliedFormat = DateFormat('d MMM, h:mm a');

  String get _range {
    final from = _dayFormat.format(request.fromDate);
    if (request.days == 1) return from;
    return '$from  →  ${_dayFormat.format(request.toDate)}';
  }

  @override
  Widget build(BuildContext context) {
    final showActions = request.status == LeaveStatus.pending &&
        (onApprove != null || onReject != null || onWithdraw != null);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showApplicant) ...[
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.primarySoft,
                  child: Text(
                    _initials(request.applicantName),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      showApplicant ? request.applicantName : request.type.label,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      showApplicant
                          ? request.type.label
                          : '${request.days} ${request.days == 1 ? 'day' : 'days'}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(
                label: request.status.label,
                color: request.status.color,
                tint: request.status.tint,
              ),
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
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (showApplicant)
                Text(
                  '${request.days}d',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            request.reason,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
          ),
          if (request.hasAttachment) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.attach_file_rounded, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    request.attachmentName ?? 'Attachment',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Text(
            'Applied ${_appliedFormat.format(request.appliedOn)}',
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
          if (request.status != LeaveStatus.pending && request.decidedByName != null) ...[
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
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                request.decisionNote!,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.35),
              ),
            ),
          ],
          if (showActions) ...[
            const SizedBox(height: 14),
            if (onWithdraw != null)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: busy ? null : onWithdraw,
                  icon: const Icon(Icons.undo_rounded, size: 17),
                  label: const Text('Withdraw'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              )
            else
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
