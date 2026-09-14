double _money(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

int? _intOrNull(Object? value) => value is num ? value.toInt() : int.tryParse('$value');

double? _doubleOrNull(Object? value) => value is num ? value.toDouble() : double.tryParse('$value');

DateTime? _date(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;

String _className(Object? value) {
  final json = (value as Map?)?.cast<String, dynamic>();
  return json == null ? '' : '${json['name']}-${json['section']}';
}

/// The web Students list's fee status: Overdue when anything is due now or an
/// assignment is overdue, else Pending while a balance remains, else Paid.
enum FeeStatus {
  paid('PAID', 'Paid'),
  pending('PENDING', 'Pending'),
  overdue('OVERDUE', 'Overdue');

  const FeeStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;
}

/// One row of GET /students for a Principal or Admin.
class StudentRow {
  const StudentRow({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.className,
    required this.isActive,
    this.classId,
    this.rollNumber,
    this.parentPhone,
    this.profilePhotoUrl,
    this.feeStatus,
    this.pendingAmount,
    this.currentOutstanding,
    this.attendancePercentage,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final String className;
  final String? classId;
  final int? rollNumber;
  final String? parentPhone;
  final String? profilePhotoUrl;
  final bool isActive;

  /// Null when the response carries no fee data (a role without fee access).
  final FeeStatus? feeStatus;
  final double? pendingAmount;
  final double? currentOutstanding;
  final int? attendancePercentage;

  factory StudentRow.fromJson(Map<String, dynamic> json) {
    final assignments = json['feeAssignments'] as List?;
    FeeStatus? status;
    double? pending;
    double? outstanding;

    if (assignments != null) {
      pending = assignments.fold<double>(0, (sum, item) => sum + _money((item as Map)['pendingAmount']));
      outstanding = _money(json['currentOutstanding']);
      final anyOverdue = assignments.any((item) => (item as Map)['status'] == 'OVERDUE');
      status = outstanding > 0 || anyOverdue
          ? FeeStatus.overdue
          : pending > 0
              ? FeeStatus.pending
              : FeeStatus.paid;
    }

    return StudentRow(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      admissionNumber: json['admissionNumber'] as String? ?? '',
      className: _className(json['class']),
      classId: json['classId'] as String?,
      rollNumber: _intOrNull(json['rollNumber']),
      parentPhone: json['parentPhone'] as String?,
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      feeStatus: status,
      pendingAmount: pending,
      currentOutstanding: outstanding,
      attendancePercentage: (json['attendancePercentage'] as num?)?.round(),
    );
  }
}

/// The web Students page filters each page again by the status it derives,
/// because the server's fee filter uses stored assignment status only: a
/// "Pending" query also returns students whose derived status is Overdue.
List<StudentRow> matchingFeeStatus(List<StudentRow> rows, FeeStatus? status) =>
    status == null ? rows : rows.where((row) => row.feeStatus == status).toList();

class StudentPage {
  const StudentPage({required this.items, required this.total, required this.page});

  final List<StudentRow> items;
  final int total;
  final int page;

  factory StudentPage.fromJson(Map<String, dynamic> json) => StudentPage(
        items: ((json['items'] as List?) ?? const [])
            .map((item) => StudentRow.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
        total: _intOrNull(json['total']) ?? 0,
        page: _intOrNull(json['page']) ?? 1,
      );
}

class StudentCounts {
  const StudentCounts({required this.active, required this.inactive});

  final int active;
  final int inactive;

  int get total => active + inactive;
}

class ClassChoice {
  const ClassChoice({required this.id, required this.name, required this.section});

  final String id;
  final String name;
  final String section;

  String get label => '$name-$section';

  factory ClassChoice.fromJson(Map<String, dynamic> json) => ClassChoice(
        id: json['id'] as String,
        name: '${json['name'] ?? ''}',
        section: '${json['section'] ?? ''}',
      );
}

class FeePayment {
  const FeePayment({
    required this.amount,
    required this.mode,
    this.paidAt,
    this.receiptNumber,
  });

  final double amount;
  final String mode;
  final DateTime? paidAt;
  final String? receiptNumber;

  factory FeePayment.fromJson(Map<String, dynamic> json) => FeePayment(
        amount: _money(json['amount']),
        mode: json['mode'] as String? ?? '',
        paidAt: _date(json['paidAt']),
        receiptNumber: ((json['receipt'] as Map?)?['receiptNo']) as String?,
      );
}

class FeeAssignment {
  const FeeAssignment({
    required this.structureName,
    required this.totalAmount,
    required this.paidAmount,
    required this.pendingAmount,
    required this.status,
    required this.payments,
  });

  final String structureName;
  final double totalAmount;
  final double paidAmount;
  final double pendingAmount;
  final String status;
  final List<FeePayment> payments;

  factory FeeAssignment.fromJson(Map<String, dynamic> json) => FeeAssignment(
        structureName: ((json['feeStructure'] as Map?)?['name'] as String?) ?? 'Fee',
        totalAmount: _money(json['totalAmount']),
        paidAmount: _money(json['paidAmount']),
        pendingAmount: _money(json['pendingAmount']),
        status: json['status'] as String? ?? '',
        payments: ((json['payments'] as List?) ?? const [])
            .map((item) => FeePayment.fromJson((item as Map).cast<String, dynamic>()))
            .toList()
          ..sort((a, b) => (b.paidAt ?? DateTime(0)).compareTo(a.paidAt ?? DateTime(0))),
      );
}

/// One exam result in the web Academic tab (`academicAnalytics.exams`).
class ExamSummary {
  const ExamSummary({
    required this.examName,
    required this.subject,
    required this.marks,
    this.percentage,
    this.grade,
    this.classAverage,
    this.rank,
    this.examDate,
  });

  final String examName;
  final String subject;

  /// "42/50", as the server formats it.
  final String marks;
  final double? percentage;
  final String? grade;
  final double? classAverage;
  final int? rank;
  final DateTime? examDate;

  factory ExamSummary.fromJson(Map<String, dynamic> json) => ExamSummary(
        examName: json['examName'] as String? ?? 'Exam',
        subject: json['subject'] as String? ?? '',
        marks: json['marks'] as String? ?? '',
        percentage: _doubleOrNull(json['percentage']),
        grade: json['grade'] as String?,
        classAverage: _doubleOrNull(json['classAverage']),
        rank: _intOrNull(json['rank']),
        examDate: _date(json['examDate']),
      );
}

/// Per-subject averages in the web Academic tab (`academicAnalytics.subjects`).
class SubjectSummary {
  const SubjectSummary({required this.subject, required this.studentAverage, required this.classAverage});

  final String subject;
  final int studentAverage;
  final int classAverage;

  factory SubjectSummary.fromJson(Map<String, dynamic> json) => SubjectSummary(
        subject: json['subject'] as String? ?? '',
        studentAverage: _intOrNull(json['studentAverage']) ?? 0,
        classAverage: _intOrNull(json['classAverage']) ?? 0,
      );
}

class StudentDocument {
  const StudentDocument({required this.name, required this.type, this.uploadedAt});

  final String name;
  final String type;
  final DateTime? uploadedAt;

  factory StudentDocument.fromJson(Map<String, dynamic> json) => StudentDocument(
        name: json['name'] as String? ?? json['originalName'] as String? ?? 'Document',
        type: json['type'] as String? ?? '',
        uploadedAt: _date(json['uploadedAt']),
      );
}

/// GET /students/:id for a Principal or Admin: everything the web profile's
/// tabs show that the app uses.
class StudentDetail {
  const StudentDetail({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.className,
    required this.academicYear,
    required this.isActive,
    required this.parentName,
    required this.parentPhone,
    required this.allowedTabs,
    required this.feeAssignments,
    required this.feeBalance,
    required this.exams,
    required this.subjects,
    required this.documents,
    required this.siblings,
    required this.attendance,
    this.rollNumber,
    this.gender,
    this.dateOfBirth,
    this.joiningDate,
    this.profilePhotoUrl,
    this.alternatePhone,
    this.fatherName,
    this.fatherPhone,
    this.motherName,
    this.motherPhone,
    this.guardianName,
    this.guardianPhone,
    this.address,
    this.previousSchool,
    this.transportRequired = false,
    this.examAverage,
    this.homeworkCompletion,
    this.performanceRate,
    this.performanceClassification,
    this.currentRank,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final String className;
  final String academicYear;
  final bool isActive;
  final int? rollNumber;
  final String? gender;
  final DateTime? dateOfBirth;
  final DateTime? joiningDate;
  final String? profilePhotoUrl;
  final String parentName;
  final String parentPhone;
  final String? alternatePhone;
  final String? fatherName;
  final String? fatherPhone;
  final String? motherName;
  final String? motherPhone;
  final String? guardianName;
  final String? guardianPhone;
  final String? address;
  final String? previousSchool;
  final bool transportRequired;

  /// The server decides which tabs this role may see.
  final List<String> allowedTabs;
  final List<FeeAssignment> feeAssignments;
  final double feeBalance;
  final List<ExamSummary> exams;
  final List<SubjectSummary> subjects;
  final List<StudentDocument> documents;
  final List<({String id, String fullName, String className})> siblings;
  final AttendanceMetrics attendance;
  final double? examAverage;
  final double? homeworkCompletion;
  final double? performanceRate;
  final String? performanceClassification;
  final int? currentRank;

  bool can(String tab) => allowedTabs.contains(tab);

  int? get age {
    final dob = dateOfBirth;
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) years--;
    return years;
  }

  factory StudentDetail.fromJson(Map<String, dynamic> json) {
    final classJson = (json['class'] as Map?)?.cast<String, dynamic>() ?? const {};
    final academic = (json['academicAnalytics'] as Map?)?.cast<String, dynamic>() ?? const {};
    final attendance = (json['attendanceAnalytics'] as Map?)?.cast<String, dynamic>() ?? const {};
    List<Map<String, dynamic>> list(Object? value) =>
        ((value as List?) ?? const []).map((item) => (item as Map).cast<String, dynamic>()).toList();

    return StudentDetail(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      admissionNumber: json['admissionNumber'] as String? ?? '',
      className: _className(classJson),
      academicYear: '${classJson['academicYear'] ?? ''}',
      isActive: json['isActive'] as bool? ?? true,
      rollNumber: _intOrNull(json['rollNumber']),
      gender: json['gender'] as String?,
      dateOfBirth: _date(json['dateOfBirth']),
      joiningDate: _date(json['joiningDate']),
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      parentName: json['parentName'] as String? ?? '',
      parentPhone: json['parentPhone'] as String? ?? '',
      alternatePhone: json['alternatePhone'] as String?,
      fatherName: json['fatherName'] as String?,
      fatherPhone: json['fatherPhone'] as String?,
      motherName: json['motherName'] as String?,
      motherPhone: json['motherPhone'] as String?,
      guardianName: json['guardianName'] as String?,
      guardianPhone: json['guardianPhone'] as String?,
      address: json['address'] as String?,
      previousSchool: json['previousSchool'] as String?,
      transportRequired: json['transportRequired'] as bool? ?? false,
      allowedTabs: (((json['access'] as Map?)?['allowedTabs'] as List?) ?? const []).map((tab) => '$tab').toList(),
      feeAssignments: list(json['feeAssignments']).map(FeeAssignment.fromJson).toList(),
      feeBalance: _money(json['feeBalance']),
      exams: list(academic['exams']).map(ExamSummary.fromJson).toList(),
      subjects: list(academic['subjects']).map(SubjectSummary.fromJson).toList(),
      documents: list(json['documents']).map(StudentDocument.fromJson).toList(),
      siblings: list(json['siblings'])
          .map((item) => (id: item['id'] as String, fullName: item['fullName'] as String? ?? '', className: _className(item['class'])))
          .toList(),
      attendance: AttendanceMetrics.fromJson((attendance['metrics'] as Map?)?.cast<String, dynamic>() ?? const {}),
      examAverage: _doubleOrNull(json['examAverage']),
      homeworkCompletion: _doubleOrNull(json['homeworkCompletion']),
      performanceRate: _doubleOrNull(json['performanceRate']),
      performanceClassification: json['performanceClassification'] as String?,
      currentRank: _intOrNull(json['currentRank']),
    );
  }
}

class AttendanceMetrics {
  const AttendanceMetrics({
    required this.percentage,
    required this.totalDays,
    required this.absences,
    required this.late,
    required this.halfDays,
    this.classAverage,
    this.remainingBefore75,
  });

  final double percentage;
  final int totalDays;
  final int absences;
  final int late;
  final int halfDays;
  final double? classAverage;

  /// Absences the student can still take before falling under 75%.
  final int? remainingBefore75;

  factory AttendanceMetrics.fromJson(Map<String, dynamic> json) => AttendanceMetrics(
        percentage: _doubleOrNull(json['attendancePercentage']) ?? 0,
        totalDays: _intOrNull(json['totalDays']) ?? 0,
        absences: _intOrNull(json['absences']) ?? 0,
        late: _intOrNull(json['late']) ?? 0,
        halfDays: _intOrNull(json['halfDays']) ?? 0,
        classAverage: _doubleOrNull(json['classAverageAttendance']),
        remainingBefore75: _intOrNull(json['remainingBefore75']),
      );
}

/// Fields for POST /students, trimmed the way the web create form trims them:
/// empty optional values are left out rather than sent blank.
class NewStudent {
  const NewStudent({
    required this.classId,
    required this.fullName,
    required this.parentName,
    required this.parentPhone,
    this.admissionNumber,
    this.rollNumber,
    this.gender,
    this.dateOfBirth,
    this.address,
  });

  final String classId;
  final String fullName;
  final String parentName;
  final String parentPhone;
  final String? admissionNumber;
  final int? rollNumber;
  final String? gender;
  final DateTime? dateOfBirth;
  final String? address;

  Map<String, dynamic> toJson() {
    String? clean(String? value) => value == null || value.trim().isEmpty ? null : value.trim();
    final dob = dateOfBirth;

    return {
      'classId': classId,
      'fullName': fullName.trim(),
      'parentName': parentName.trim(),
      'parentPhone': parentPhone.trim(),
      if (clean(admissionNumber) != null) 'admissionNumber': clean(admissionNumber),
      if (rollNumber != null) 'rollNumber': rollNumber,
      if (gender != null) 'gender': gender,
      if (dob != null)
        'dateOfBirth':
            '${dob.year.toString().padLeft(4, '0')}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}',
      if (clean(address) != null) 'address': clean(address),
      'transportRequired': false,
      'transportFeeAmount': 0,
    };
  }
}
