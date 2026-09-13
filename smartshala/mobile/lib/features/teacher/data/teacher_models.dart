enum PunchState { notPunchedIn, punchedIn, punchedOut }

class PunchStatus {
  const PunchStatus({
    required this.state,
    this.punchInAt,
    this.punchOutAt,
    this.workedMinutes = 0,
  });

  final PunchState state;
  final DateTime? punchInAt;
  final DateTime? punchOutAt;
  final int workedMinutes;

  static const empty = PunchStatus(state: PunchState.notPunchedIn);

  factory PunchStatus.fromJson(Map<String, dynamic> json) => PunchStatus(
        state: switch (json['state'] as String?) {
          'PUNCHED_IN' => PunchState.punchedIn,
          'PUNCHED_OUT' => PunchState.punchedOut,
          _ => PunchState.notPunchedIn,
        },
        punchInAt: _parseDate(json['punchInAt']),
        punchOutAt: _parseDate(json['punchOutAt']),
        workedMinutes: (json['workedMinutes'] as num?)?.toInt() ?? 0,
      );

  static DateTime? _parseDate(Object? value) =>
      value is String ? DateTime.tryParse(value)?.toLocal() : null;
}

/// One row of the teacher's timetable for a weekday. [startTime] and
/// [endTime] are the school bell's "HH:mm", null until the principal sets them.
class SchedulePeriod {
  const SchedulePeriod({
    required this.periodNumber,
    required this.className,
    required this.subjectName,
    this.classId,
    this.startTime,
    this.endTime,
  });

  final int periodNumber;
  final String className;
  final String subjectName;
  final String? classId;
  final String? startTime;
  final String? endTime;

  /// Minutes after midnight, or null when the period has no time.
  int? get startMinute => _minutesOf(startTime);
  int? get endMinute => _minutesOf(endTime);

  factory SchedulePeriod.fromJson(Map<String, dynamic> json) => SchedulePeriod(
        periodNumber: (json['periodNumber'] as num).toInt(),
        className: json['className'] as String? ?? '—',
        subjectName: json['subjectName'] as String? ?? '—',
        classId: json['classId'] as String?,
        startTime: json['startTime'] as String?,
        endTime: json['endTime'] as String?,
      );
}

int? _minutesOf(String? time) {
  final parts = time?.split(':');
  if (parts == null || parts.length != 2) return null;
  final hours = int.tryParse(parts[0]);
  final minutes = int.tryParse(parts[1]);
  return hours == null || minutes == null ? null : hours * 60 + minutes;
}

enum PeriodBadge { now, upcoming }

/// The blueprint's "Now" and "Upcoming" badges at [now]: the period in
/// progress, and the single next one to start. Untimed periods get neither.
/// The bell is validated to run in period order, so list order is time order.
List<PeriodBadge?> scheduleBadges(List<SchedulePeriod> periods, DateTime now) {
  final minute = now.hour * 60 + now.minute;
  var upcomingGiven = false;

  return periods.map((period) {
    final start = period.startMinute;
    final end = period.endMinute;
    if (start == null || end == null) return null;
    if (start <= minute && minute < end) return PeriodBadge.now;
    if (!upcomingGiven && start > minute) {
      upcomingGiven = true;
      return PeriodBadge.upcoming;
    }
    return null;
  }).toList();
}

/// The four "Today's Overview" counters on the teacher home screen.
class TeacherOverview {
  const TeacherOverview({
    required this.assignedClasses,
    required this.assignedStudents,
    required this.pendingHomeworkSubmissions,
    required this.pendingAttendance,
  });

  final int assignedClasses;
  final int assignedStudents;
  final int pendingHomeworkSubmissions;
  final int pendingAttendance;

  static const empty = TeacherOverview(
    assignedClasses: 0,
    assignedStudents: 0,
    pendingHomeworkSubmissions: 0,
    pendingAttendance: 0,
  );

  factory TeacherOverview.fromJson(Map<String, dynamic> json) {
    final kpis = (json['kpis'] as Map?)?.cast<String, dynamic>() ?? const {};
    int read(String key) => (kpis[key] as num?)?.toInt() ?? 0;

    return TeacherOverview(
      assignedClasses: read('assignedClasses'),
      assignedStudents: read('assignedStudents'),
      pendingHomeworkSubmissions: read('pendingHomeworkSubmissions'),
      pendingAttendance: read('pendingAttendance'),
    );
  }
}

/// One class in "Your Class Attendance" — a row of the daily report the web
/// dashboard charts.
class ClassAttendance {
  const ClassAttendance({
    required this.className,
    required this.marked,
    required this.totalStudents,
    required this.present,
    required this.absent,
    required this.attendancePercentage,
    this.classId,
  });

  final String? classId;
  final String className;
  final bool marked;
  final int totalStudents;
  final int present;
  final int absent;
  final int attendancePercentage;

  factory ClassAttendance.fromJson(Map<String, dynamic> json) => ClassAttendance(
        classId: json['classId'] as String?,
        className: json['className'] as String? ?? '—',
        marked: json['marked'] as bool? ?? false,
        totalStudents: (json['totalStudents'] as num?)?.toInt() ?? 0,
        present: (json['present'] as num?)?.toInt() ?? 0,
        absent: (json['absent'] as num?)?.toInt() ?? 0,
        attendancePercentage: (json['attendancePercentage'] as num?)?.round() ?? 0,
      );
}

enum AlertSeverity { high, medium, low }

/// An action item from GET /dashboard, e.g. attendance not yet submitted.
class DashboardAlert {
  const DashboardAlert({required this.type, required this.message, required this.severity});

  final String type;
  final String message;
  final AlertSeverity severity;

  factory DashboardAlert.fromJson(Map<String, dynamic> json) => DashboardAlert(
        type: json['type'] as String? ?? '',
        message: (json['message'] ?? json['studentName'] ?? 'Action needed') as String,
        severity: switch (json['severity'] as String?) {
          'HIGH' => AlertSeverity.high,
          'MEDIUM' => AlertSeverity.medium,
          _ => AlertSeverity.low,
        },
      );
}

/// Everything the teacher dashboard shows from GET /dashboard — the same
/// response, and the same derived numbers, as the web teacher dashboard.
class TeacherDashboard {
  const TeacherDashboard({
    required this.overview,
    required this.attendance,
    required this.alerts,
  });

  final TeacherOverview overview;
  final List<ClassAttendance> attendance;
  final List<DashboardAlert> alerts;

  static const empty = TeacherDashboard(overview: TeacherOverview.empty, attendance: [], alerts: []);

  int get markedClasses => attendance.where((item) => item.marked).length;

  /// The web's pulse line, word for word.
  String get pulse =>
      '${overview.pendingAttendance} attendance actions and ${overview.pendingHomeworkSubmissions} '
      'homework submissions pending for your students.';

  factory TeacherDashboard.fromJson(Map<String, dynamic> json) => TeacherDashboard(
        overview: TeacherOverview.fromJson(json),
        attendance: ((json['attendance'] as List?) ?? const [])
            .map((item) => ClassAttendance.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        alerts: ((json['alerts'] as List?) ?? const [])
            .map((item) => DashboardAlert.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class ClassOption {
  const ClassOption({required this.id, required this.name, required this.section});

  final String id;
  final String name;
  final String section;

  String get label => '$name-$section';

  factory ClassOption.fromJson(Map<String, dynamic> json) => ClassOption(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        section: json['section'] as String? ?? '',
      );
}

enum AttendanceMark { present, absent, late, halfDay }

extension AttendanceMarkApi on AttendanceMark {
  String get apiValue => switch (this) {
        AttendanceMark.present => 'PRESENT',
        AttendanceMark.absent => 'ABSENT',
        AttendanceMark.late => 'LATE',
        AttendanceMark.halfDay => 'HALF_DAY',
      };

  static AttendanceMark fromApi(String? value) => switch (value) {
        'ABSENT' => AttendanceMark.absent,
        'LATE' => AttendanceMark.late,
        'HALF_DAY' => AttendanceMark.halfDay,
        _ => AttendanceMark.present,
      };
}

class RosterStudent {
  RosterStudent({
    required this.id,
    required this.fullName,
    required this.rollNumber,
    required this.mark,
  });

  final String id;
  final String fullName;
  final int? rollNumber;
  AttendanceMark mark;

  factory RosterStudent.fromJson(Map<String, dynamic> json) => RosterStudent(
        id: json['id'] as String,
        fullName: (json['fullName'] ?? json['name'] ?? '') as String,
        rollNumber: (json['rollNumber'] as num?)?.toInt(),
        // Previously saved marks win; otherwise the server's PRESENT default
        // applies, which is how teachers actually work — flip only the absentees.
        mark: AttendanceMarkApi.fromApi(
          (json['savedStatus'] ?? json['defaultStatus']) as String?,
        ),
      );
}

/// A class roster for one date, plus whether it may be edited at all.
class AttendanceRoster {
  const AttendanceRoster({
    required this.className,
    required this.students,
    required this.canEdit,
    required this.isHoliday,
    required this.alreadySubmitted,
    this.holidayReason,
  });

  final String className;
  final List<RosterStudent> students;
  final bool canEdit;
  final bool isHoliday;
  final bool alreadySubmitted;
  final String? holidayReason;

  int get presentCount =>
      students.where((student) => student.mark != AttendanceMark.absent).length;
  int get absentCount => students.where((student) => student.mark == AttendanceMark.absent).length;

  factory AttendanceRoster.fromJson(Map<String, dynamic> json) => AttendanceRoster(
        className: json['className'] as String? ?? '',
        canEdit: json['canEdit'] as bool? ?? true,
        isHoliday: json['isHoliday'] as bool? ?? false,
        holidayReason: json['holidayReason'] as String?,
        alreadySubmitted: json['session'] != null,
        students: ((json['students'] as List?) ?? const [])
            .map((item) => RosterStudent.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}
