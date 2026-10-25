/// One child a signed-in parent can view. Returned by GET /parent/children.
class ParentChild {
  const ParentChild({
    required this.id,
    required this.fullName,
    this.rollNumber,
    this.className,
    this.admissionNumber,
    this.profilePhotoUrl,
  });

  final String id;
  final String fullName;
  final int? rollNumber;
  final String? className;
  final String? admissionNumber;
  final String? profilePhotoUrl;

  /// "Aarav Sharma" -> "AS", for the avatar fallback.
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory ParentChild.fromJson(Map<String, dynamic> json) => ParentChild(
        id: json['id'] as String,
        fullName: (json['fullName'] ?? '') as String,
        rollNumber: json['rollNumber'] as int?,
        className: json['className'] as String?,
        admissionNumber: json['admissionNumber'] as String?,
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
      );
}

/// How a child was marked on one school day.
enum AttendanceStatus { present, absent, leave, unknown }

AttendanceStatus attendanceStatusFrom(String? raw) => switch (raw) {
      'PRESENT' => AttendanceStatus.present,
      'ABSENT' => AttendanceStatus.absent,
      'LEAVE' => AttendanceStatus.leave,
      _ => AttendanceStatus.unknown,
    };

/// The counts shared by the Home summary and the Attendance screen.
class AttendanceSummary {
  const AttendanceSummary({
    required this.month,
    required this.percentage,
    required this.present,
    required this.absent,
    required this.leave,
    required this.totalDays,
  });

  final String month; // YYYY-MM
  final double percentage;
  final int present;
  final int absent;
  final int leave;
  final int totalDays;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) => AttendanceSummary(
        month: (json['month'] ?? '') as String,
        percentage: (json['percentage'] as num?)?.toDouble() ?? 0,
        present: (json['present'] as num?)?.toInt() ?? 0,
        absent: (json['absent'] as num?)?.toInt() ?? 0,
        leave: (json['leave'] as num?)?.toInt() ?? 0,
        totalDays: (json['totalDays'] as num?)?.toInt() ?? 0,
      );
}

/// One marked school day, for the attendance calendar.
class AttendanceDay {
  const AttendanceDay({required this.date, required this.status});

  final DateTime date;
  final AttendanceStatus status;

  factory AttendanceDay.fromJson(Map<String, dynamic> json) => AttendanceDay(
        date: DateTime.parse(json['date'] as String),
        status: attendanceStatusFrom(json['status'] as String?),
      );
}

/// GET /parent/children/:id/attendance — a month of marks plus its summary.
class MonthlyAttendance {
  const MonthlyAttendance({required this.summary, required this.daily});

  final AttendanceSummary summary;
  final List<AttendanceDay> daily;

  factory MonthlyAttendance.fromJson(Map<String, dynamic> json) {
    final s = json['summary'] as Map<String, dynamic>? ?? const {};
    return MonthlyAttendance(
      summary: AttendanceSummary.fromJson({...s, 'month': json['month']}),
      daily: ((json['daily'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(AttendanceDay.fromJson)
          .toList(),
    );
  }
}

/// GET /parent/children/:id/home — the child plus this month's attendance.
class ChildHome {
  const ChildHome({
    required this.parentName,
    required this.child,
    required this.attendance,
    required this.todayStatus,
  });

  /// The signed-in parent's name, for the home greeting.
  final String parentName;
  final ParentChild child;
  final AttendanceSummary attendance;
  final AttendanceStatus? todayStatus;

  factory ChildHome.fromJson(Map<String, dynamic> json) {
    final a = json['attendance'] as Map<String, dynamic>? ?? const {};
    final today = a['todayStatus'] as String?;
    return ChildHome(
      parentName: (json['parentName'] ?? '') as String,
      child: ParentChild.fromJson(json['child'] as Map<String, dynamic>),
      attendance: AttendanceSummary.fromJson(a),
      todayStatus: today == null ? null : attendanceStatusFrom(today),
    );
  }
}

/// One subject's result within an exam.
class ExamSubject {
  const ExamSubject({
    required this.subject,
    required this.marks,
    required this.percentage,
    required this.grade,
    required this.isAbsent,
  });

  final String subject;
  final String marks; // "85/100"
  final int percentage;
  final String grade;
  final bool isAbsent;

  factory ExamSubject.fromJson(Map<String, dynamic> json) => ExamSubject(
        subject: (json['subject'] ?? '—') as String,
        marks: (json['marks'] ?? '') as String,
        percentage: (json['percentage'] as num?)?.toInt() ?? 0,
        grade: (json['grade'] ?? '') as String,
        isAbsent: json['isAbsent'] as bool? ?? false,
      );
}

/// One exam/test with its per-subject rows and an overall percentage.
class ExamResultGroup {
  const ExamResultGroup({
    required this.id,
    required this.name,
    required this.term,
    required this.date,
    required this.percentage,
    required this.grade,
    required this.subjects,
  });

  final String id;
  final String name;
  final String? term;
  final DateTime? date;
  final int percentage;
  final String grade;
  final List<ExamSubject> subjects;

  factory ExamResultGroup.fromJson(Map<String, dynamic> json) => ExamResultGroup(
        id: (json['id'] ?? '') as String,
        name: (json['name'] ?? '') as String,
        term: json['term'] as String?,
        date: json['date'] == null ? null : DateTime.tryParse(json['date'] as String),
        percentage: (json['percentage'] as num?)?.toInt() ?? 0,
        grade: (json['grade'] ?? '') as String,
        subjects: ((json['subjects'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(ExamSubject.fromJson)
            .toList(),
      );
}

/// GET /parent/children/:id/academics
class ChildAcademics {
  const ChildAcademics({required this.overallPercentage, required this.overallGrade, required this.exams});

  final int overallPercentage;
  final String overallGrade;
  final List<ExamResultGroup> exams;

  factory ChildAcademics.fromJson(Map<String, dynamic> json) {
    final overall = json['overall'] as Map<String, dynamic>? ?? const {};
    return ChildAcademics(
      overallPercentage: (overall['percentage'] as num?)?.toInt() ?? 0,
      overallGrade: (overall['grade'] ?? '') as String,
      exams: ((json['exams'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(ExamResultGroup.fromJson)
          .toList(),
    );
  }
}

/// One fee assignment for a child — what it is, and what is still due.
class FeeAssignment {
  const FeeAssignment({
    required this.id,
    required this.name,
    required this.total,
    required this.paid,
    required this.pending,
    required this.status,
    required this.payable,
  });

  final String id;
  final String name;
  final double total;
  final double paid;
  final double pending;
  final String status; // PAID / PARTIAL / PENDING
  final bool payable;

  factory FeeAssignment.fromJson(Map<String, dynamic> json) => FeeAssignment(
        id: (json['id'] ?? '') as String,
        name: (json['name'] ?? 'Fee') as String,
        total: (json['total'] as num?)?.toDouble() ?? 0,
        paid: (json['paid'] as num?)?.toDouble() ?? 0,
        pending: (json['pending'] as num?)?.toDouble() ?? 0,
        status: (json['status'] ?? 'PENDING') as String,
        payable: json['payable'] as bool? ?? false,
      );
}

/// One past payment, with the receipt to download.
class FeePayment {
  const FeePayment({
    required this.paymentId,
    required this.amount,
    required this.paidAt,
    required this.mode,
    this.receiptId,
    this.receiptNo,
    this.feeStructureName,
  });

  final String paymentId;
  final double amount;
  final DateTime? paidAt;
  final String mode;
  final String? receiptId;
  final String? receiptNo;
  final String? feeStructureName;

  factory FeePayment.fromJson(Map<String, dynamic> json) => FeePayment(
        paymentId: (json['paymentId'] ?? '') as String,
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        paidAt: json['paidAt'] == null ? null : DateTime.tryParse(json['paidAt'] as String),
        mode: (json['mode'] ?? '') as String,
        receiptId: json['receiptId'] as String?,
        receiptNo: json['receiptNo'] as String?,
        feeStructureName: json['feeStructureName'] as String?,
      );
}

/// GET /parent/children/:id/fees — the summary, assignments and payment history.
class ChildFees {
  const ChildFees({
    required this.total,
    required this.paid,
    required this.balance,
    required this.status,
    required this.assignments,
    required this.payments,
  });

  final double total;
  final double paid;
  final double balance;
  final String status;
  final List<FeeAssignment> assignments;
  final List<FeePayment> payments;

  factory ChildFees.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    return ChildFees(
      total: (summary['total'] as num?)?.toDouble() ?? 0,
      paid: (summary['paid'] as num?)?.toDouble() ?? 0,
      balance: (summary['balance'] as num?)?.toDouble() ?? 0,
      status: (summary['status'] ?? 'PENDING') as String,
      assignments: ((json['assignments'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(FeeAssignment.fromJson)
          .toList(),
      payments: ((json['payments'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(FeePayment.fromJson)
          .toList(),
    );
  }
}

/// One document on a child's file — a report card, certificate and the like.
/// Listed by GET /parent/children/:id/documents, downloaded on demand.
class ParentDocument {
  const ParentDocument({
    required this.id,
    required this.type,
    required this.name,
    required this.originalName,
    required this.sizeBytes,
    this.mimeType,
    this.uploadedAt,
  });

  final String id;
  final String type; // StudentDocumentType, e.g. REPORT_CARD
  final String name;
  final String originalName;
  final int sizeBytes;
  final String? mimeType;
  final DateTime? uploadedAt;

  /// "REPORT_CARD" -> "Report Card", for display.
  String get typeLabel => type
      .split('_')
      .map((word) => word.isEmpty ? word : '${word[0]}${word.substring(1).toLowerCase()}')
      .join(' ');

  factory ParentDocument.fromJson(Map<String, dynamic> json) => ParentDocument(
        id: (json['id'] ?? '') as String,
        type: (json['type'] ?? '') as String,
        name: (json['name'] ?? '') as String,
        originalName: (json['originalName'] ?? '') as String,
        sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
        mimeType: json['mimeType'] as String?,
        uploadedAt: json['uploadedAt'] == null ? null : DateTime.tryParse(json['uploadedAt'] as String),
      );
}

/// One homework assignment with this child's submission state.
class HomeworkItem {
  const HomeworkItem({
    required this.id,
    required this.title,
    required this.completed,
    this.subject,
    this.description,
    this.assignedDate,
    this.dueDate,
    this.status,
  });

  final String id;
  final String title;
  final bool completed;
  final String? subject;
  final String? description;
  final DateTime? assignedDate;
  final DateTime? dueDate;
  final String? status;

  factory HomeworkItem.fromJson(Map<String, dynamic> json) => HomeworkItem(
        id: (json['id'] ?? '') as String,
        title: (json['title'] ?? '') as String,
        completed: json['completed'] as bool? ?? false,
        subject: json['subject'] as String?,
        description: json['description'] as String?,
        assignedDate: json['assignedDate'] == null ? null : DateTime.tryParse(json['assignedDate'] as String),
        dueDate: json['dueDate'] == null ? null : DateTime.tryParse(json['dueDate'] as String),
        status: json['status'] as String?,
      );
}

/// A leave/absence request a parent has raised for their child.
class ParentLeaveRequest {
  const ParentLeaveRequest({
    required this.id,
    required this.fromDate,
    required this.toDate,
    required this.days,
    required this.reason,
    required this.status,
    this.appliedOn,
    this.decisionNote,
    this.decidedByName,
  });

  final String id;
  final DateTime fromDate;
  final DateTime toDate;
  final int days;
  final String reason;
  final String status; // PENDING | APPROVED | REJECTED | CANCELLED
  final DateTime? appliedOn;
  final String? decisionNote;
  final String? decidedByName;

  bool get isPending => status == 'PENDING';
  bool get isApproved => status == 'APPROVED';

  factory ParentLeaveRequest.fromJson(Map<String, dynamic> json) => ParentLeaveRequest(
        id: (json['id'] ?? '') as String,
        fromDate: DateTime.parse(json['fromDate'] as String),
        toDate: DateTime.parse(json['toDate'] as String),
        days: (json['days'] as num?)?.toInt() ?? 1,
        reason: (json['reason'] ?? '') as String,
        status: (json['status'] ?? 'PENDING') as String,
        appliedOn: json['appliedOn'] == null ? null : DateTime.tryParse(json['appliedOn'] as String),
        decisionNote: json['decisionNote'] as String?,
        decidedByName: (json['decidedBy'] as Map<String, dynamic>?)?['fullName'] as String?,
      );
}
