import 'teacher_models.dart';

// Exams are shared with the principal app; teacher screens keep importing them from here.
export '../../../core/data/exam_models.dart';

/// A class with the subjects this teacher may attach work to.
class TeachingClass {
  const TeachingClass({
    required this.id,
    required this.name,
    required this.section,
    required this.subjects,
    this.studentCount,
  });

  final String id;
  final String name;
  final String section;
  final List<SubjectOption> subjects;
  final int? studentCount;

  String get label => '$name-$section';

  ClassOption get asOption => ClassOption(id: id, name: name, section: section);

  factory TeachingClass.fromJson(Map<String, dynamic> json) => TeachingClass(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        section: json['section'] as String? ?? '',
        studentCount: (json['studentCount'] as num?)?.toInt(),
        subjects: ((json['subjects'] as List?) ?? const [])
            .map((item) => SubjectOption.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class SubjectOption {
  const SubjectOption({required this.id, required this.name});

  final String id;
  final String name;

  factory SubjectOption.fromJson(Map<String, dynamic> json) =>
      SubjectOption(id: json['id'] as String, name: json['name'] as String? ?? '');
}

// ---------------------------------------------------------------- homework

enum SubmissionStatus { onTime, late, missing, notSubmitted }

extension SubmissionStatusApi on SubmissionStatus {
  String get apiValue => switch (this) {
        SubmissionStatus.onTime => 'ON_TIME',
        SubmissionStatus.late => 'LATE',
        SubmissionStatus.missing => 'MISSING',
        SubmissionStatus.notSubmitted => 'NOT_SUBMITTED',
      };

  String get label => switch (this) {
        SubmissionStatus.onTime => 'On time',
        SubmissionStatus.late => 'Late',
        SubmissionStatus.missing => 'Missing',
        SubmissionStatus.notSubmitted => 'Not submitted',
      };

  static SubmissionStatus fromApi(String? value) => switch (value) {
        'ON_TIME' => SubmissionStatus.onTime,
        'LATE' => SubmissionStatus.late,
        'MISSING' => SubmissionStatus.missing,
        _ => SubmissionStatus.notSubmitted,
      };
}

class HomeworkAssignment {
  const HomeworkAssignment({
    required this.id,
    required this.title,
    required this.className,
    required this.subject,
    required this.dueDate,
    required this.submittedCount,
    required this.totalStudents,
    required this.notSubmittedCount,
    required this.lateCount,
    this.description,
  });

  final String id;
  final String title;
  final String className;
  final String subject;
  final DateTime dueDate;
  final int submittedCount;
  final int totalStudents;
  final int notSubmittedCount;
  final int lateCount;
  final String? description;

  bool get isOverdue => dueDate.isBefore(DateTime.now()) && submittedCount < totalStudents;

  factory HomeworkAssignment.fromJson(Map<String, dynamic> json) => HomeworkAssignment(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        className: json['className'] as String? ?? '',
        subject: json['subject'] as String? ?? 'General',
        description: json['description'] as String?,
        dueDate: DateTime.parse(json['dueDate'] as String).toLocal(),
        submittedCount: (json['submittedCount'] as num?)?.toInt() ?? 0,
        totalStudents: (json['totalStudents'] as num?)?.toInt() ?? 0,
        notSubmittedCount: (json['notSubmittedCount'] as num?)?.toInt() ?? 0,
        lateCount: (json['lateCount'] as num?)?.toInt() ?? 0,
      );
}

class HomeworkSubmission {
  HomeworkSubmission({
    required this.studentId,
    required this.studentName,
    required this.rollNumber,
    required this.status,
  });

  final String studentId;
  final String studentName;
  final int? rollNumber;
  SubmissionStatus status;

  factory HomeworkSubmission.fromJson(Map<String, dynamic> json) => HomeworkSubmission(
        studentId: json['studentId'] as String,
        studentName: json['studentName'] as String? ?? '',
        rollNumber: (json['rollNumber'] as num?)?.toInt(),
        status: SubmissionStatusApi.fromApi(json['status'] as String?),
      );
}

class HomeworkDetail {
  const HomeworkDetail({required this.assignment, required this.submissions});

  final HomeworkAssignment assignment;
  final List<HomeworkSubmission> submissions;

  factory HomeworkDetail.fromJson(Map<String, dynamic> json) => HomeworkDetail(
        assignment: HomeworkAssignment.fromJson(json),
        submissions: ((json['submissions'] as List?) ?? const [])
            .map((item) => HomeworkSubmission.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

// ---------------------------------------------------------------- students

/// A student as the teacher portal sees them — academic signals only.
/// The server omits every fee field for TEACHER accounts.
class StudentListItem {
  const StudentListItem({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.rollNumber,
    required this.className,
    this.attendancePercentage,
    this.examAverage,
    this.profilePhotoUrl,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final int? rollNumber;
  final String className;
  final double? attendancePercentage;
  final double? examAverage;
  final String? profilePhotoUrl;

  factory StudentListItem.fromJson(Map<String, dynamic> json) {
    final classJson = (json['class'] as Map?)?.cast<String, dynamic>();
    return StudentListItem(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      admissionNumber: json['admissionNumber'] as String? ?? '',
      rollNumber: (json['rollNumber'] as num?)?.toInt(),
      className: classJson == null ? '' : '${classJson['name']}-${classJson['section']}',
      attendancePercentage: (json['attendancePercentage'] as num?)?.toDouble(),
      examAverage: (json['examAverage'] as num?)?.toDouble(),
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
    );
  }
}

class StudentProfile {
  const StudentProfile({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.rollNumber,
    required this.className,
    this.gender,
    this.dateOfBirth,
    this.parentName,
    this.parentPhone,
    this.address,
    this.attendancePercentage,
    this.examAverage,
    this.homeworkCompletion,
    this.profilePhotoUrl,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final int? rollNumber;
  final String className;
  final String? gender;
  final DateTime? dateOfBirth;
  final String? parentName;
  final String? parentPhone;
  final String? address;
  final double? attendancePercentage;
  final double? examAverage;
  final double? homeworkCompletion;
  final String? profilePhotoUrl;

  int? get age {
    final dob = dateOfBirth;
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) years--;
    return years;
  }

  factory StudentProfile.fromJson(Map<String, dynamic> json) {
    final classJson = (json['class'] as Map?)?.cast<String, dynamic>();
    final dob = json['dateOfBirth'] as String?;

    return StudentProfile(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      admissionNumber: json['admissionNumber'] as String? ?? '',
      rollNumber: (json['rollNumber'] as num?)?.toInt(),
      className: classJson == null ? '' : '${classJson['name']}-${classJson['section']}',
      gender: json['gender'] as String?,
      dateOfBirth: dob == null ? null : DateTime.tryParse(dob)?.toLocal(),
      parentName: json['parentName'] as String?,
      parentPhone: json['parentPhone'] as String?,
      address: json['address'] as String?,
      attendancePercentage: (json['attendancePercentage'] as num?)?.toDouble(),
      examAverage: (json['examAverage'] as num?)?.toDouble(),
      homeworkCompletion: (json['homeworkCompletion'] as num?)?.toDouble(),
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
    );
  }
}

enum FocusReason { lowAttendance, lowMarks, missingHomework }

extension FocusReasonLabel on FocusReason {
  String get label => switch (this) {
        FocusReason.lowAttendance => 'Low attendance',
        FocusReason.lowMarks => 'Low marks',
        FocusReason.missingHomework => 'Missing homework',
      };

  static FocusReason? fromApi(String value) => switch (value) {
        'LOW_ATTENDANCE' => FocusReason.lowAttendance,
        'LOW_MARKS' => FocusReason.lowMarks,
        'MISSING_HOMEWORK' => FocusReason.missingHomework,
        _ => null,
      };
}

class FocusStudent {
  const FocusStudent({
    required this.studentId,
    required this.fullName,
    required this.rollNumber,
    required this.className,
    required this.reasons,
    required this.isHigh,
    this.attendancePercent,
    this.averageMarksPercent,
    this.missingHomeworkCount = 0,
  });

  final String studentId;
  final String fullName;
  final int? rollNumber;
  final String? className;
  final List<FocusReason> reasons;
  final bool isHigh;
  final int? attendancePercent;
  final int? averageMarksPercent;
  final int missingHomeworkCount;

  factory FocusStudent.fromJson(Map<String, dynamic> json) => FocusStudent(
        studentId: json['studentId'] as String,
        fullName: json['fullName'] as String? ?? '',
        rollNumber: (json['rollNumber'] as num?)?.toInt(),
        className: json['className'] as String?,
        isHigh: json['severity'] == 'HIGH',
        attendancePercent: (json['attendancePercent'] as num?)?.toInt(),
        averageMarksPercent: (json['averageMarksPercent'] as num?)?.toInt(),
        missingHomeworkCount: (json['missingHomeworkCount'] as num?)?.toInt() ?? 0,
        reasons: ((json['reasons'] as List?) ?? const [])
            .map((item) => FocusReasonLabel.fromApi(item as String))
            .whereType<FocusReason>()
            .toList(),
      );
}

/// The published thresholds behind the focus flags, so the screen can state
/// exactly why a student was listed.
class FocusThresholds {
  const FocusThresholds({
    required this.attendancePercent,
    required this.averageMarksPercent,
    required this.missingHomeworkCount,
    required this.lookbackDays,
  });

  final int attendancePercent;
  final int averageMarksPercent;
  final int missingHomeworkCount;
  final int lookbackDays;

  static const fallback = FocusThresholds(
    attendancePercent: 75,
    averageMarksPercent: 40,
    missingHomeworkCount: 3,
    lookbackDays: 30,
  );

  factory FocusThresholds.fromJson(Map<String, dynamic> json) => FocusThresholds(
        attendancePercent: (json['attendancePercent'] as num?)?.toInt() ?? 75,
        averageMarksPercent: (json['averageMarksPercent'] as num?)?.toInt() ?? 40,
        missingHomeworkCount: (json['missingHomeworkCount'] as num?)?.toInt() ?? 3,
        lookbackDays: (json['lookbackDays'] as num?)?.toInt() ?? 30,
      );
}

class FocusResult {
  const FocusResult({required this.thresholds, required this.students});

  final FocusThresholds thresholds;
  final List<FocusStudent> students;

  factory FocusResult.fromJson(Map<String, dynamic> json) => FocusResult(
        thresholds: json['thresholds'] == null
            ? FocusThresholds.fallback
            : FocusThresholds.fromJson((json['thresholds'] as Map).cast<String, dynamic>()),
        students: ((json['students'] as List?) ?? const [])
            .map((item) => FocusStudent.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}
