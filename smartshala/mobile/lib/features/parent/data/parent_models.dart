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
    required this.child,
    required this.attendance,
    required this.todayStatus,
  });

  final ParentChild child;
  final AttendanceSummary attendance;
  final AttendanceStatus? todayStatus;

  factory ChildHome.fromJson(Map<String, dynamic> json) {
    final a = json['attendance'] as Map<String, dynamic>? ?? const {};
    final today = a['todayStatus'] as String?;
    return ChildHome(
      child: ParentChild.fromJson(json['child'] as Map<String, dynamic>),
      attendance: AttendanceSummary.fromJson(a),
      todayStatus: today == null ? null : attendanceStatusFrom(today),
    );
  }
}
