import '../../../core/data/messages_models.dart';

/// A parent-raised child-leave request as the office reviews it. Status styling
/// (label, colour) is shared with staff leave through [LeaveStatus].
class StudentLeaveRequest {
  const StudentLeaveRequest({
    required this.id,
    required this.studentName,
    required this.className,
    required this.rollNumber,
    required this.status,
    required this.fromDate,
    required this.toDate,
    required this.days,
    required this.reason,
    required this.appliedOn,
    required this.requestedByName,
    this.decidedByName,
    this.decisionNote,
  });

  final String id;
  final String studentName;
  final String? className;
  final int? rollNumber;
  final LeaveStatus status;
  final DateTime fromDate;
  final DateTime toDate;
  final int days;
  final String reason;
  final DateTime appliedOn;
  final String? requestedByName;
  final String? decidedByName;
  final String? decisionNote;

  factory StudentLeaveRequest.fromJson(Map<String, dynamic> json) {
    final student = (json['student'] as Map?)?.cast<String, dynamic>() ?? const {};
    final decidedBy = (json['decidedBy'] as Map?)?.cast<String, dynamic>();
    return StudentLeaveRequest(
      id: json['id'] as String,
      studentName: student['fullName'] as String? ?? 'Student',
      className: student['className'] as String?,
      rollNumber: (student['rollNumber'] as num?)?.toInt(),
      status: LeaveStatusX.fromApi(json['status'] as String?),
      // The server sends the leave dates as UTC midnights; reading them back as
      // UTC keeps the calendar day from sliding across the timezone boundary.
      fromDate: _parseDay(json['fromDate']),
      toDate: _parseDay(json['toDate']),
      days: (json['days'] as num?)?.toInt() ?? 1,
      reason: json['reason'] as String? ?? '',
      appliedOn: _parseLocal(json['appliedOn']) ?? DateTime.now(),
      requestedByName: json['requestedByName'] as String?,
      decidedByName: decidedBy?['fullName'] as String?,
      decisionNote: json['decisionNote'] as String?,
    );
  }
}

class StudentLeaveSummary {
  const StudentLeaveSummary({
    required this.total,
    required this.pending,
    required this.approved,
    required this.rejected,
    required this.cancelled,
  });

  final int total;
  final int pending;
  final int approved;
  final int rejected;
  final int cancelled;

  static const empty = StudentLeaveSummary(total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0);

  factory StudentLeaveSummary.fromJson(Map<String, dynamic> json) {
    final pending = (json['PENDING'] as num?)?.toInt() ?? 0;
    final approved = (json['APPROVED'] as num?)?.toInt() ?? 0;
    final rejected = (json['REJECTED'] as num?)?.toInt() ?? 0;
    final cancelled = (json['CANCELLED'] as num?)?.toInt() ?? 0;
    return StudentLeaveSummary(
      total: pending + approved + rejected + cancelled,
      pending: pending,
      approved: approved,
      rejected: rejected,
      cancelled: cancelled,
    );
  }
}

class StudentLeavePage {
  const StudentLeavePage({required this.items, required this.hasMore, required this.summary});

  final List<StudentLeaveRequest> items;
  final bool hasMore;
  final StudentLeaveSummary summary;

  static const empty = StudentLeavePage(items: [], hasMore: false, summary: StudentLeaveSummary.empty);

  factory StudentLeavePage.fromJson(Map<String, dynamic> json) => StudentLeavePage(
        items: ((json['items'] as List?) ?? const [])
            .map((item) => StudentLeaveRequest.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        hasMore: json['hasMore'] as bool? ?? false,
        summary: json['summary'] == null
            ? StudentLeaveSummary.empty
            : StudentLeaveSummary.fromJson((json['summary'] as Map).cast<String, dynamic>()),
      );

  StudentLeavePage appending(StudentLeavePage next) =>
      StudentLeavePage(items: [...items, ...next.items], hasMore: next.hasMore, summary: next.summary);
}

DateTime _parseDay(Object? value) {
  final parsed = value is String ? DateTime.tryParse(value) : null;
  return (parsed ?? DateTime.now()).toUtc();
}

DateTime? _parseLocal(Object? value) {
  final parsed = value is String ? DateTime.tryParse(value) : null;
  return parsed?.toLocal();
}
