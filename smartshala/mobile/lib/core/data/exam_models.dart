// Exams, shared by the teacher Marks screen and the principal Exams screen.
// Both read and write the same /marks endpoints.

/// The terms the server accepts, with the web exams page's labels. Teachers
/// may only create the first two; the server enforces it.
enum ExamTerm {
  unitTest('UNIT_TEST', 'Unit Test'),
  classTest('CLASS_TEST', 'Class Test'),
  midTerm('MID_TERM', 'Mid-Term'),
  finalExam('FINAL', 'Final'),
  term1('TERM_1', 'Term 1'),
  term2('TERM_2', 'Term 2');

  const ExamTerm(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static const teacherTerms = [ExamTerm.unitTest, ExamTerm.classTest];

  static ExamTerm? fromApi(String? value) => values.where((term) => term.apiValue == value).firstOrNull;
}

class ExamSummary {
  const ExamSummary({
    required this.id,
    required this.name,
    required this.className,
    required this.subject,
    required this.date,
    required this.maxMarks,
    required this.classAverage,
    required this.enteredCount,
    required this.pendingCount,
    this.classId,
    this.term,
    this.passingMarks,
    this.description,
  });

  final String id;
  final String name;
  final String className;
  final String subject;
  final DateTime date;
  final double maxMarks;
  final int classAverage;
  final int enteredCount;
  final int pendingCount;
  final String? classId;
  final ExamTerm? term;
  final double? passingMarks;
  final String? description;

  /// The server calls any exam dated today or earlier "marks entered", even
  /// with no marks yet, so the apps derive the stage from the counts instead.
  ExamStage stageAt(DateTime now) {
    final today = DateTime(now.year, now.month, now.day);
    if (DateTime(date.year, date.month, date.day).isAfter(today) && enteredCount == 0) return ExamStage.scheduled;
    if (enteredCount > 0 && pendingCount == 0) return ExamStage.complete;
    return ExamStage.marksPending;
  }

  factory ExamSummary.fromJson(Map<String, dynamic> json) => ExamSummary(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        className: json['className'] as String? ?? '',
        subject: json['subject'] as String? ?? 'General',
        classId: json['classId'] as String?,
        date: DateTime.parse(json['date'] as String).toLocal(),
        maxMarks: (json['maxMarks'] as num?)?.toDouble() ?? 0,
        classAverage: (json['classAverage'] as num?)?.toInt() ?? 0,
        enteredCount: (json['enteredCount'] as num?)?.toInt() ?? 0,
        pendingCount: (json['pendingCount'] as num?)?.toInt() ?? 0,
        term: ExamTerm.fromApi(json['term'] as String?),
        passingMarks: (json['passingMarks'] as num?)?.toDouble(),
        description: json['description'] as String?,
      );
}

enum ExamStage {
  scheduled('Scheduled'),
  marksPending('Marks pending'),
  complete('Marks entered');

  const ExamStage(this.label);

  final String label;
}

class ExamStudentResult {
  ExamStudentResult({
    required this.studentId,
    required this.fullName,
    required this.rollNumber,
    this.marks,
    this.percentage,
    this.grade,
    this.isAbsent = false,
  });

  final String studentId;
  final String fullName;
  final int? rollNumber;
  double? marks;
  final double? percentage;
  final String? grade;
  bool isAbsent;

  bool get hasResult => marks != null;

  factory ExamStudentResult.fromJson(Map<String, dynamic> json) {
    final result = (json['result'] as Map?)?.cast<String, dynamic>();
    return ExamStudentResult(
      studentId: json['studentId'] as String,
      fullName: json['fullName'] as String? ?? '',
      rollNumber: (json['rollNumber'] as num?)?.toInt(),
      marks: (result?['marks'] as num?)?.toDouble(),
      percentage: (result?['percentage'] as num?)?.toDouble(),
      grade: result?['grade'] as String?,
      isAbsent: result?['isAbsent'] as bool? ?? false,
    );
  }
}

class ExamDetail {
  const ExamDetail({required this.exam, required this.students});

  final ExamSummary exam;
  final List<ExamStudentResult> students;

  /// Top three by percentage, entered results only.
  List<ExamStudentResult> get topPerformers {
    final scored = students.where((s) => s.hasResult && !s.isAbsent).toList()
      ..sort((a, b) => (b.marks ?? 0).compareTo(a.marks ?? 0));
    return scored.take(3).toList();
  }

  factory ExamDetail.fromJson(Map<String, dynamic> json) => ExamDetail(
        exam: ExamSummary.fromJson(json),
        students: ((json['students'] as List?) ?? const [])
            .map((item) => ExamStudentResult.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

/// A class an exam can be scheduled for, from GET /marks/context: the server
/// already limits a teacher to their own classes and subjects.
class ExamClass {
  const ExamClass({required this.id, required this.label, required this.subjects, required this.studentCount});

  final String id;
  final String label;
  final List<({String id, String name})> subjects;
  final int studentCount;

  factory ExamClass.fromJson(Map<String, dynamic> json) => ExamClass(
        id: json['id'] as String,
        label: '${json['name'] ?? ''}-${json['section'] ?? ''}',
        studentCount: ((json['students'] as List?) ?? const []).length,
        subjects: [
          for (final item in (json['subjects'] as List?) ?? const [])
            (id: (item as Map)['id'] as String, name: item['name'] as String? ?? ''),
        ],
      );

  static List<ExamClass> listFromContext(Map<String, dynamic> json) => ((json['classes'] as List?) ?? const [])
      .map((item) => ExamClass.fromJson((item as Map).cast<String, dynamic>()))
      .toList();
}

/// POST /marks/exams with no results: the exam is scheduled, and marks are
/// entered per student afterwards.
class NewExam {
  const NewExam({
    required this.classId,
    required this.subjectId,
    required this.name,
    required this.term,
    required this.maxMarks,
    required this.date,
    this.passingMarks,
    this.description,
  });

  final String classId;
  final String subjectId;
  final String name;
  final ExamTerm term;
  final double maxMarks;
  final DateTime date;
  final double? passingMarks;
  final String? description;

  Map<String, dynamic> toJson() => {
        'classId': classId,
        'subjectId': subjectId,
        'name': name.trim(),
        'term': term.apiValue,
        'maxMarks': maxMarks,
        if (passingMarks != null) 'passingMarks': passingMarks,
        if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
        'date': '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
        'results': const <Object>[],
      };
}
