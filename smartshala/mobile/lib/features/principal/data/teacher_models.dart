import '../../../core/data/messages_models.dart';
import 'student_models.dart';

int? _intOrNull(Object? value) => value is num ? value.toInt() : int.tryParse('$value');

/// The web Teachers page counts periods over Monday to Saturday.
const _timetableDays = {'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'};

class TeacherPeriod {
  const TeacherPeriod({
    required this.dayOfWeek,
    required this.periodNumber,
    this.classId,
    this.subjectId,
    required this.className,
    required this.subjectName,
  });

  final String dayOfWeek;
  final int periodNumber;
  final String? classId;
  final String? subjectId;
  final String className;
  final String subjectName;

  factory TeacherPeriod.fromJson(Map<String, dynamic> json) => TeacherPeriod(
        dayOfWeek: '${json['dayOfWeek'] ?? ''}',
        periodNumber: _intOrNull(json['periodNumber']) ?? 0,
        classId: json['classId'] as String?,
        subjectId: json['subjectId'] as String?,
        className: '${json['className'] ?? ''}',
        subjectName: '${json['subjectName'] ?? ''}',
      );
}

/// A teacher as `GET /users/teachers` and `GET /users/teachers/:id` return one.
/// The profile-only fields ([academicBackground], [joinedAt]) are null on list rows
/// that don't carry them.
class TeacherRow {
  const TeacherRow({
    required this.id,
    required this.fullName,
    this.email,
    required this.phone,
    required this.status,
    this.periods = const [],
    this.classTeacherFor = const [],
    this.periodCount = 8,
    this.academicBackground,
    this.joinedAt,
  });

  final String id;
  final String fullName;
  final String? email;
  final String phone;
  final String status;
  final List<TeacherPeriod> periods;
  final List<ClassChoice> classTeacherFor;
  final int periodCount;
  final String? academicBackground;
  final DateTime? joinedAt;

  bool get isActive => status == 'ACTIVE';

  /// Distinct subjects taught, from the timetable, as the web Subject filter lists them.
  List<String> get subjects => ({
        for (final period in periods)
          if (period.subjectId != null && period.subjectName.isNotEmpty) period.subjectName,
      }.toList()..sort());

  /// Distinct classes taught, from the timetable.
  List<String> get classes => ({
        for (final period in periods)
          if (period.classId != null) period.className,
      }.toList()..sort());

  List<String> get classTeacherLabels => [for (final item in classTeacherFor) item.label];

  /// The web's `classTeacherLabel`.
  String get classTeacherLabel => classTeacherFor.isEmpty ? 'None' : classTeacherLabels.join(', ');

  /// The web's `assignedPeriodCount`.
  int get assignedPeriods => periods
      .where((period) =>
          period.classId != null && _timetableDays.contains(period.dayOfWeek) && period.periodNumber <= periodCount)
      .length;

  /// The web's `totalTimetableSlots`.
  int get totalSlots => _timetableDays.length * periodCount;

  /// The server's search, run locally: name, phone or email contains the text.
  bool matches(String query) {
    final text = query.trim().toLowerCase();
    if (text.isEmpty) return true;
    return fullName.toLowerCase().contains(text) ||
        phone.contains(text) ||
        (email?.toLowerCase().contains(text) ?? false);
  }

  factory TeacherRow.fromJson(Map<String, dynamic> json) => TeacherRow(
        id: json['id'] as String,
        fullName: '${json['fullName'] ?? ''}',
        email: json['email'] as String?,
        phone: '${json['phone'] ?? ''}',
        status: '${json['status'] ?? 'ACTIVE'}',
        periods: ((json['periodAssignments'] as List?) ?? const [])
            .map((item) => TeacherPeriod.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        classTeacherFor: ((json['classTeacherFor'] as List?) ?? const [])
            .map((item) => ClassChoice.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        periodCount: _intOrNull(json['timetablePeriodCount']) ?? 8,
        academicBackground: json['academicBackground'] as String?,
        joinedAt: DateTime.tryParse('${json['createdAt']}')?.toLocal(),
      );
}

class TeacherCounts {
  const TeacherCounts({required this.active, required this.inactive});

  final int active;
  final int inactive;

  int get total => active + inactive;
}

/// `GET /staff-attendance/users/:id/summary`: one month of working days.
class TeacherAttendanceSummary {
  const TeacherAttendanceSummary({
    required this.workingDays,
    required this.presentDays,
    required this.leaveDays,
    required this.absentDays,
    this.percentage,
  });

  final int workingDays;
  final int presentDays;
  final int leaveDays;
  final int absentDays;
  final int? percentage;

  factory TeacherAttendanceSummary.fromJson(Map<String, dynamic> json) => TeacherAttendanceSummary(
        workingDays: _intOrNull(json['workingDays']) ?? 0,
        presentDays: _intOrNull(json['presentDays']) ?? 0,
        leaveDays: _intOrNull(json['leaveDays']) ?? 0,
        absentDays: _intOrNull(json['absentDays']) ?? 0,
        percentage: _intOrNull(json['percentage']),
      );
}

enum StaffDayStatus { notPunchedIn, onLeave, present }

/// One teacher's row in `GET /staff-attendance/day`.
class StaffDayRow {
  const StaffDayRow({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.status,
    this.leaveType,
    this.punchInAt,
    this.punchOutAt,
    this.workedMinutes,
  });

  final String id;
  final String fullName;
  final String phone;
  final StaffDayStatus status;
  final LeaveType? leaveType;
  final DateTime? punchInAt;
  final DateTime? punchOutAt;

  /// Null when a past day's punch was never closed.
  final int? workedMinutes;

  static DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;

  factory StaffDayRow.fromJson(Map<String, dynamic> json) => StaffDayRow(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        status: switch (json['status']) {
          'PRESENT' => StaffDayStatus.present,
          'ON_LEAVE' => StaffDayStatus.onLeave,
          _ => StaffDayStatus.notPunchedIn,
        },
        leaveType: json['leaveType'] == null ? null : LeaveTypeX.fromApi(json['leaveType'] as String?),
        punchInAt: _time(json['punchInAt']),
        punchOutAt: _time(json['punchOutAt']),
        workedMinutes: _intOrNull(json['workedMinutes']),
      );
}

/// `GET /staff-attendance/day`: every active teacher's punch on one day,
/// not-punched-in first.
class StaffDay {
  const StaffDay({
    required this.isSunday,
    required this.present,
    required this.onLeave,
    required this.notPunchedIn,
    required this.staff,
    this.holiday,
  });

  final bool isSunday;
  final String? holiday;
  final int present;
  final int onLeave;
  final int notPunchedIn;
  final List<StaffDayRow> staff;

  factory StaffDay.fromJson(Map<String, dynamic> json) => StaffDay(
        isSunday: json['isSunday'] == true,
        holiday: json['holiday'] as String?,
        present: _intOrNull(json['present']) ?? 0,
        onLeave: _intOrNull(json['onLeave']) ?? 0,
        notPunchedIn: _intOrNull(json['notPunchedIn']) ?? 0,
        staff: [
          for (final row in (json['staff'] as List? ?? const []))
            StaffDayRow.fromJson(Map<String, dynamic>.from(row as Map)),
        ],
      );
}

/// The web Add Teacher form: blank optional fields are left out.
class NewTeacher {
  const NewTeacher({
    required this.fullName,
    required this.phone,
    required this.password,
    this.email = '',
    this.academicBackground = '',
  });

  final String fullName;
  final String phone;
  final String password;
  final String email;
  final String academicBackground;

  Map<String, dynamic> toJson() => {
        'fullName': fullName.trim(),
        'phone': phone.trim(),
        'password': password,
        if (email.trim().isNotEmpty) 'email': email.trim(),
        if (academicBackground.trim().isNotEmpty) 'academicBackground': academicBackground.trim(),
      };
}

/// The web Edit Teacher form's body: a blank email clears it.
Map<String, dynamic> teacherUpdateJson({required String fullName, required String phone, required String email}) => {
      'fullName': fullName.trim(),
      'email': email.trim().isEmpty ? null : email.trim(),
      'phone': phone.trim(),
    };

/// Export List. The web has no teacher export, so the columns are the web table's.
String teachersCsv(List<TeacherRow> teachers) {
  String cell(Object? value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
  final rows = [
    ['Name', 'Email', 'Phone', 'Subjects', 'Class Teacher', 'Periods', 'Status'],
    for (final teacher in teachers)
      [
        teacher.fullName,
        teacher.email ?? '',
        teacher.phone,
        teacher.subjects.join(', '),
        teacher.classTeacherLabel,
        '${teacher.assignedPeriods}/${teacher.totalSlots}',
        teacher.status,
      ],
  ];
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}
