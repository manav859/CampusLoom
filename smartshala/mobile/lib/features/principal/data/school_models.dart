// School Profile and Classes & Sections for the principal app, read from the
// same endpoints as the web Settings and Classes pages.

int? _intOrNull(Object? value) => value is num ? value.toInt() : int.tryParse('$value');

String? _text(Object? value) {
  final text = value is String ? value.trim() : null;
  return text == null || text.isEmpty ? null : text;
}

/// GET /settings/school-profile.
class SchoolProfile {
  const SchoolProfile({
    required this.name,
    required this.code,
    required this.timetablePeriodCount,
    this.city,
    this.state,
    this.phone,
    this.udiseNumber,
    this.affiliationBoard,
    this.logoUrl,
  });

  final String name;
  final String code;
  final String? city;
  final String? state;
  final String? phone;
  final String? udiseNumber;
  final String? affiliationBoard;

  /// A data URL of the resized logo the web uploads, or an image URL.
  final String? logoUrl;
  final int timetablePeriodCount;

  /// The web Settings page's board choices.
  static const boards = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge'];

  factory SchoolProfile.fromJson(Map<String, dynamic> json) => SchoolProfile(
        name: json['name'] as String? ?? '',
        code: json['code'] as String? ?? '',
        city: _text(json['city']),
        state: _text(json['state']),
        phone: _text(json['phone']),
        udiseNumber: _text(json['udiseNumber']),
        affiliationBoard: _text(json['affiliationBoard']),
        logoUrl: _text(json['logoUrl']),
        timetablePeriodCount: _intOrNull(json['timetablePeriodCount']) ?? 8,
      );

  /// PATCH /settings/school-profile replaces the whole profile: a logo or
  /// period count left out would be cleared or reset to 8, so both always
  /// travel back as they were.
  Map<String, dynamic> updateJson({
    required String name,
    required String? city,
    required String? state,
    required String? phone,
    required String? udiseNumber,
    required String? affiliationBoard,
  }) =>
      {
        'name': name.trim(),
        'city': _text(city),
        'state': _text(state),
        'phone': _text(phone),
        'udiseNumber': _text(udiseNumber),
        'affiliationBoard': _text(affiliationBoard),
        'logoUrl': logoUrl,
        'timetablePeriodCount': timetablePeriodCount,
      };
}

class SubjectItem {
  const SubjectItem({required this.id, required this.name});

  final String id;
  final String name;
}

/// A class from GET /classes or GET /classes/:id.
class ClassRow {
  const ClassRow({
    required this.id,
    required this.name,
    required this.section,
    required this.academicYear,
    required this.subjects,
    required this.studentCount,
    this.classTeacherId,
    this.classTeacherName,
    this.maximumStrength,
    this.stream,
    this.mediumOfInstruction,
  });

  final String id;
  final String name;
  final String section;
  final String academicYear;
  final List<SubjectItem> subjects;
  final int studentCount;
  final String? classTeacherId;
  final String? classTeacherName;
  final int? maximumStrength;
  final String? stream;
  final String? mediumOfInstruction;

  String get label => '$name-$section';

  bool matches(String query) {
    final text = query.trim().toLowerCase();
    if (text.isEmpty) return true;
    return label.toLowerCase().contains(text) ||
        '$name $section'.toLowerCase().contains(text) ||
        (classTeacherName?.toLowerCase().contains(text) ?? false);
  }

  factory ClassRow.fromJson(Map<String, dynamic> json) {
    final teacher = (json['classTeacher'] as Map?)?.cast<String, dynamic>();
    return ClassRow(
      id: json['id'] as String,
      name: '${json['name'] ?? ''}',
      section: '${json['section'] ?? ''}',
      academicYear: '${json['academicYear'] ?? ''}',
      classTeacherId: json['classTeacherId'] as String? ?? teacher?['id'] as String?,
      classTeacherName: teacher?['fullName'] as String?,
      maximumStrength: _intOrNull(json['maximumStrength']),
      stream: _text(json['stream']),
      mediumOfInstruction: _text(json['mediumOfInstruction']),
      studentCount: _intOrNull((json['_count'] as Map?)?['students']) ?? 0,
      subjects: [
        for (final item in (json['subjects'] as List?) ?? const [])
          SubjectItem(id: (item as Map)['id'] as String, name: '${item['name'] ?? ''}'),
      ]..sort((a, b) => a.name.compareTo(b.name)),
    );
  }
}

/// GET /classes/:id/stats, the last 30 days.
class ClassStats {
  const ClassStats({this.attendancePercent, this.marksAveragePercent, this.feeCollectionPercent});

  final int? attendancePercent;
  final int? marksAveragePercent;
  final int? feeCollectionPercent;

  factory ClassStats.fromJson(Map<String, dynamic> json) => ClassStats(
        attendancePercent: _intOrNull(json['attendancePercent']),
        marksAveragePercent: _intOrNull(json['marksAveragePercent']),
        feeCollectionPercent: _intOrNull(json['feeCollectionPercent']),
      );
}

class ClassStudent {
  const ClassStudent({required this.id, required this.fullName, required this.admissionNumber, this.rollNumber});

  final String id;
  final String fullName;
  final String admissionNumber;
  final int? rollNumber;

  factory ClassStudent.fromJson(Map<String, dynamic> json) => ClassStudent(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        admissionNumber: json['admissionNumber'] as String? ?? '',
        rollNumber: _intOrNull(json['rollNumber']),
      );
}

/// The web New Class form's defaults.
const defaultClassSubjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies'];
const suggestedClassSubjects = [...defaultClassSubjects, 'Computer Science', 'Sanskrit', 'General Knowledge'];

/// The web's fallback academic year label for a school with none current:
/// "2026-27" during 2026.
String fallbackAcademicYear(DateTime now) => '${now.year}-${(now.year + 1).toString().substring(2)}';

/// The body of POST /classes, and of PATCH /classes/:id for an edit.
class ClassDraft {
  const ClassDraft({
    required this.name,
    required this.section,
    required this.academicYear,
    required this.classTeacherId,
    required this.mediumOfInstruction,
    required this.subjects,
    this.maximumStrength,
    this.stream,
  });

  final String name;
  final String section;
  final String academicYear;
  final String classTeacherId;
  final String mediumOfInstruction;
  final List<String> subjects;
  final int? maximumStrength;
  final String? stream;

  /// A duplicate typed with different case or spacing counts once.
  static List<String> uniqueSubjects(Iterable<String> subjects) {
    final seen = <String>{};
    return [
      for (final subject in subjects.map((item) => item.trim()))
        if (subject.isNotEmpty && seen.add(subject.toLowerCase())) subject,
    ];
  }

  Map<String, dynamic> toJson({bool forUpdate = false}) => {
        'name': name.trim(),
        'section': section.trim(),
        // The academic year is fixed once a class exists.
        if (!forUpdate) 'academicYear': academicYear,
        'classTeacherId': classTeacherId,
        'mediumOfInstruction': mediumOfInstruction.trim(),
        'subjects': uniqueSubjects(subjects),
        if (maximumStrength != null) 'maximumStrength': maximumStrength,
        if (forUpdate || _text(stream) != null) 'stream': _text(stream),
      };
}
