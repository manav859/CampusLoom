import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

// Leave and announcements are the one domain both binaries render, so the
// models and their presentation rules live in core/ rather than under either
// app's feature folder.

enum LeaveType { casual, sick, earned, maternity, unpaid, other }

extension LeaveTypeX on LeaveType {
  String get apiValue => switch (this) {
        LeaveType.casual => 'CASUAL',
        LeaveType.sick => 'SICK',
        LeaveType.earned => 'EARNED',
        LeaveType.maternity => 'MATERNITY',
        LeaveType.unpaid => 'UNPAID',
        LeaveType.other => 'OTHER',
      };

  String get label => switch (this) {
        LeaveType.casual => 'Casual Leave',
        LeaveType.sick => 'Sick Leave',
        LeaveType.earned => 'Earned Leave',
        LeaveType.maternity => 'Maternity Leave',
        LeaveType.unpaid => 'Unpaid Leave',
        LeaveType.other => 'Other',
      };

  static LeaveType fromApi(String? value) => switch (value) {
        'CASUAL' => LeaveType.casual,
        'SICK' => LeaveType.sick,
        'EARNED' => LeaveType.earned,
        'MATERNITY' => LeaveType.maternity,
        'UNPAID' => LeaveType.unpaid,
        _ => LeaveType.other,
      };
}

enum LeaveStatus { pending, approved, rejected, cancelled }

extension LeaveStatusX on LeaveStatus {
  String get apiValue => switch (this) {
        LeaveStatus.pending => 'PENDING',
        LeaveStatus.approved => 'APPROVED',
        LeaveStatus.rejected => 'REJECTED',
        LeaveStatus.cancelled => 'CANCELLED',
      };

  String get label => switch (this) {
        LeaveStatus.pending => 'Pending',
        LeaveStatus.approved => 'Approved',
        LeaveStatus.rejected => 'Rejected',
        LeaveStatus.cancelled => 'Withdrawn',
      };

  Color get color => switch (this) {
        LeaveStatus.pending => AppColors.warning,
        LeaveStatus.approved => AppColors.success,
        LeaveStatus.rejected => AppColors.danger,
        LeaveStatus.cancelled => AppColors.textSecondary,
      };

  Color get tint => switch (this) {
        LeaveStatus.pending => AppColors.warningSoft,
        LeaveStatus.approved => AppColors.successSoft,
        LeaveStatus.rejected => AppColors.dangerSoft,
        LeaveStatus.cancelled => AppColors.background,
      };

  static LeaveStatus fromApi(String? value) => switch (value) {
        'APPROVED' => LeaveStatus.approved,
        'REJECTED' => LeaveStatus.rejected,
        'CANCELLED' => LeaveStatus.cancelled,
        _ => LeaveStatus.pending,
      };
}

class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.type,
    required this.status,
    required this.fromDate,
    required this.toDate,
    required this.days,
    required this.reason,
    required this.appliedOn,
    required this.applicantId,
    required this.applicantName,
    this.hasAttachment = false,
    this.attachmentName,
    this.decidedAt,
    this.decisionNote,
    this.decidedByName,
  });

  final String id;
  final LeaveType type;
  final LeaveStatus status;
  final DateTime fromDate;
  final DateTime toDate;
  final int days;
  final String reason;
  final DateTime appliedOn;
  final String applicantId;
  final String applicantName;
  final bool hasAttachment;
  final String? attachmentName;
  final DateTime? decidedAt;
  final String? decisionNote;
  final String? decidedByName;

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    final applicant = (json['applicant'] as Map?)?.cast<String, dynamic>() ?? const {};
    final decidedBy = (json['decidedBy'] as Map?)?.cast<String, dynamic>();

    return LeaveRequest(
      id: json['id'] as String,
      type: LeaveTypeX.fromApi(json['type'] as String?),
      status: LeaveStatusX.fromApi(json['status'] as String?),
      // Leave dates are stored at midnight UTC so a day never shifts; they are
      // read back as UTC for the same reason.
      fromDate: _parseUtcDay(json['fromDate']),
      toDate: _parseUtcDay(json['toDate']),
      days: (json['days'] as num?)?.toInt() ?? 1,
      reason: json['reason'] as String? ?? '',
      appliedOn: _parseLocal(json['appliedOn']) ?? DateTime.now(),
      applicantId: applicant['id'] as String? ?? '',
      applicantName: applicant['fullName'] as String? ?? 'Staff member',
      hasAttachment: json['hasAttachment'] as bool? ?? false,
      attachmentName: json['attachmentName'] as String?,
      decidedAt: _parseLocal(json['decidedAt']),
      decisionNote: json['decisionNote'] as String?,
      decidedByName: decidedBy?['fullName'] as String?,
    );
  }
}

/// A file the user picked for a leave request, before it is uploaded. The
/// server accepts PDF, JPEG, PNG and WebP up to 5 MB and rejects the rest.
class LeaveAttachment {
  const LeaveAttachment({required this.name, required this.path, required this.sizeBytes});

  final String name;
  final String path;
  final int sizeBytes;

  static const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  static const maxSizeBytes = 5 * 1024 * 1024;

  bool get isTooLarge => sizeBytes > maxSizeBytes;

  String get readableSize {
    if (sizeBytes >= 1024 * 1024) {
      return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(sizeBytes / 1024).ceil()} KB';
  }
}

class LeaveSummary {
  const LeaveSummary({
    this.total = 0,
    this.pending = 0,
    this.approved = 0,
    this.rejected = 0,
    this.cancelled = 0,
  });

  final int total;
  final int pending;
  final int approved;
  final int rejected;
  final int cancelled;

  static const empty = LeaveSummary();

  factory LeaveSummary.fromJson(Map<String, dynamic> json) => LeaveSummary(
        total: (json['total'] as num?)?.toInt() ?? 0,
        pending: (json['pending'] as num?)?.toInt() ?? 0,
        approved: (json['approved'] as num?)?.toInt() ?? 0,
        rejected: (json['rejected'] as num?)?.toInt() ?? 0,
        cancelled: (json['cancelled'] as num?)?.toInt() ?? 0,
      );
}

/// A page of leave requests plus the tile counts for the whole set, so the
/// stat row never needs a second request to stay in step with the list.
class LeavePage {
  const LeavePage({
    required this.items,
    required this.total,
    required this.hasMore,
    required this.summary,
  });

  final List<LeaveRequest> items;
  final int total;
  final bool hasMore;
  final LeaveSummary summary;

  static const empty =
      LeavePage(items: [], total: 0, hasMore: false, summary: LeaveSummary.empty);

  factory LeavePage.fromJson(Map<String, dynamic> json) => LeavePage(
        items: ((json['items'] as List?) ?? const [])
            .map((item) => LeaveRequest.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        total: (json['total'] as num?)?.toInt() ?? 0,
        hasMore: json['hasMore'] as bool? ?? false,
        summary: LeaveSummary.fromJson(
          (json['summary'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
      );

  LeavePage appending(LeavePage next) => LeavePage(
        items: [...items, ...next.items],
        total: next.total,
        hasMore: next.hasMore,
        summary: next.summary,
      );
}

enum AnnouncementPriority { normal, important, urgent }

extension AnnouncementPriorityX on AnnouncementPriority {
  String get apiValue => switch (this) {
        AnnouncementPriority.normal => 'NORMAL',
        AnnouncementPriority.important => 'IMPORTANT',
        AnnouncementPriority.urgent => 'URGENT',
      };

  String get label => switch (this) {
        AnnouncementPriority.normal => 'Normal',
        AnnouncementPriority.important => 'Important',
        AnnouncementPriority.urgent => 'Urgent',
      };

  Color get color => switch (this) {
        AnnouncementPriority.normal => AppColors.primary,
        AnnouncementPriority.important => AppColors.warning,
        AnnouncementPriority.urgent => AppColors.danger,
      };

  Color get tint => switch (this) {
        AnnouncementPriority.normal => AppColors.primarySoft,
        AnnouncementPriority.important => AppColors.warningSoft,
        AnnouncementPriority.urgent => AppColors.dangerSoft,
      };

  static AnnouncementPriority fromApi(String? value) => switch (value) {
        'IMPORTANT' => AnnouncementPriority.important,
        'URGENT' => AnnouncementPriority.urgent,
        _ => AnnouncementPriority.normal,
      };
}

enum AnnouncementAudience { all, staff, teachers, parents }

extension AnnouncementAudienceX on AnnouncementAudience {
  String get apiValue => switch (this) {
        AnnouncementAudience.all => 'ALL',
        AnnouncementAudience.staff => 'STAFF',
        AnnouncementAudience.teachers => 'TEACHERS',
        AnnouncementAudience.parents => 'PARENTS',
      };

  String get label => switch (this) {
        AnnouncementAudience.all => 'Everyone',
        AnnouncementAudience.staff => 'All staff',
        AnnouncementAudience.teachers => 'Teachers only',
        AnnouncementAudience.parents => 'Parents only',
      };

  static AnnouncementAudience fromApi(String? value) => switch (value) {
        'STAFF' => AnnouncementAudience.staff,
        'TEACHERS' => AnnouncementAudience.teachers,
        'PARENTS' => AnnouncementAudience.parents,
        _ => AnnouncementAudience.all,
      };
}

class Announcement {
  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.audience,
    required this.priority,
    required this.publishedAt,
    required this.isRead,
    this.postedByName,
  });

  final String id;
  final String title;
  final String body;
  final AnnouncementAudience audience;
  final AnnouncementPriority priority;
  final DateTime publishedAt;
  final bool isRead;
  final String? postedByName;

  Announcement asRead() => Announcement(
        id: id,
        title: title,
        body: body,
        audience: audience,
        priority: priority,
        publishedAt: publishedAt,
        isRead: true,
        postedByName: postedByName,
      );

  factory Announcement.fromJson(Map<String, dynamic> json) {
    final postedBy = (json['postedBy'] as Map?)?.cast<String, dynamic>();

    return Announcement(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      audience: AnnouncementAudienceX.fromApi(json['audience'] as String?),
      priority: AnnouncementPriorityX.fromApi(json['priority'] as String?),
      publishedAt: _parseLocal(json['publishedAt']) ?? DateTime.now(),
      isRead: json['isRead'] as bool? ?? false,
      postedByName: postedBy?['fullName'] as String?,
    );
  }
}

class AnnouncementPage {
  const AnnouncementPage({
    required this.items,
    required this.total,
    required this.unreadCount,
    required this.hasMore,
  });

  final List<Announcement> items;
  final int total;
  final int unreadCount;
  final bool hasMore;

  static const empty = AnnouncementPage(items: [], total: 0, unreadCount: 0, hasMore: false);

  factory AnnouncementPage.fromJson(Map<String, dynamic> json) => AnnouncementPage(
        items: ((json['items'] as List?) ?? const [])
            .map((item) => Announcement.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        total: (json['total'] as num?)?.toInt() ?? 0,
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
        hasMore: json['hasMore'] as bool? ?? false,
      );
}

DateTime? _parseLocal(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

/// Leave dates carry no time of day. Reading them in UTC keeps "10 Sep" as
/// 10 Sep for a device in any timezone.
DateTime _parseUtcDay(Object? value) {
  final parsed = value is String ? DateTime.tryParse(value)?.toUtc() : null;
  if (parsed == null) return DateTime.now();
  return DateTime(parsed.year, parsed.month, parsed.day);
}
