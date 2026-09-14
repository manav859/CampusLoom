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
