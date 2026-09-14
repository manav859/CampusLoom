import 'package:intl/intl.dart';

import '../../../core/api/api_client.dart';
import '../../../core/data/calendar_models.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/data/exam_models.dart';
import 'fee_models.dart';
import 'principal_dashboard.dart';
import 'report_models.dart';
import 'school_models.dart';
import 'student_models.dart' hide ExamSummary;
import 'teacher_models.dart';

class PrincipalRepository {
  PrincipalRepository(this.api);

  final ApiClient api;

  /// The same GET /dashboard the web admin dashboard reads.
  Future<PrincipalDashboard> dashboard() async {
    final data = await api.get('/dashboard') as Map<String, dynamic>;
    return PrincipalDashboard.fromJson(data);
  }

  /// Today's activity feed, with the query the web dashboard sends.
  Future<List<ActivityEntry>> activity(DateTime day) async {
    final date = DateFormat('yyyy-MM-dd').format(day);
    final data =
        await api.get(
              '/activity-logs',
              query: {
                'dateFrom': date,
                'dateTo': date,
                'excludeEntityType': 'CHATBOT',
                'limit': 12,
                'page': 1,
              },
            )
            as Map<String, dynamic>;

    return ((data['items'] as List?) ?? const [])
        .take(12)
        .map(
          (item) =>
              ActivityEntry.fromJson((item as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  // -------------------------------------------------------------- students

  /// One page of GET /students with the filters the web Students page sends.
  Future<StudentPage> students({
    int page = 1,
    int limit = 20,
    String? search,
    String? classId,
    FeeStatus? feeStatus,
    bool inactive = false,
  }) async {
    final data = await api.get('/students', query: {
      'page': page,
      'limit': limit,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (classId != null) 'classId': classId,
      if (feeStatus != null) 'feeStatus': feeStatus.apiValue,
      if (inactive) 'showInactive': 'true',
    }) as Map<String, dynamic>;
    return StudentPage.fromJson(data);
  }

  /// Active and inactive totals for the stat tiles: two one-row pages, since
  /// the list endpoint returns its total with every page.
  Future<StudentCounts> studentCounts() async {
    final pages = await Future.wait([
      students(limit: 1),
      students(limit: 1, inactive: true),
    ]);
    return StudentCounts(active: pages[0].total, inactive: pages[1].total);
  }

  /// Every student matching the filters, 100 at a time, for Export List.
  Future<List<StudentRow>> allStudents({String? search, String? classId, FeeStatus? feeStatus, bool inactive = false}) async {
    final rows = <StudentRow>[];
    var page = 1;
    while (true) {
      final result = await students(
        page: page,
        limit: 100,
        search: search,
        classId: classId,
        feeStatus: feeStatus,
        inactive: inactive,
      );
      rows.addAll(result.items);
      if (result.items.isEmpty || rows.length >= result.total) return matchingFeeStatus(rows, feeStatus);
      page++;
    }
  }

  Future<StudentDetail> student(String id) async {
    final data = await api.get('/students/$id') as Map<String, dynamic>;
    return StudentDetail.fromJson(data);
  }

  Future<List<ClassChoice>> classes() async {
    final data = await api.get('/classes');
    final items = data is List ? data : (data as Map<String, dynamic>)['items'] as List? ?? const [];
    return items.map((item) => ClassChoice.fromJson((item as Map).cast<String, dynamic>())).toList();
  }

  /// Returns the new student's id.
  Future<String> createStudent(NewStudent student) async {
    final data = await api.post('/students', body: student.toJson()) as Map<String, dynamic>;
    return data['id'] as String;
  }

  Future<void> deactivateStudent(String id) => api.delete('/students/$id');

  Future<void> activateStudent(String id) => api.patch('/students/$id/activate');

  // -------------------------------------------------------------- teachers

  /// Every active or inactive teacher, 100 at a time. The web Teachers page
  /// loads the whole list and filters it locally, and so does the app.
  Future<List<TeacherRow>> teachers({bool inactive = false}) async {
    final rows = <TeacherRow>[];
    var page = 1;
    while (true) {
      final data = await api.get('/users/teachers', query: {
        'page': page,
        'limit': 100,
        if (inactive) 'showInactive': 'true',
      }) as Map<String, dynamic>;
      final items = (data['items'] as List?) ?? const [];
      rows.addAll(items.map((item) => TeacherRow.fromJson((item as Map).cast<String, dynamic>())));
      final total = data['total'] is num ? (data['total'] as num).toInt() : rows.length;
      if (items.isEmpty || rows.length >= total) return rows;
      page++;
    }
  }

  /// Active and inactive totals for the stat tiles, from two one-row pages.
  Future<TeacherCounts> teacherCounts() async {
    Future<int> total(bool inactive) async {
      final data = await api.get('/users/teachers', query: {
        'limit': 1,
        if (inactive) 'showInactive': 'true',
      }) as Map<String, dynamic>;
      return (data['total'] as num?)?.toInt() ?? 0;
    }

    final totals = await Future.wait([total(false), total(true)]);
    return TeacherCounts(active: totals[0], inactive: totals[1]);
  }

  Future<TeacherRow> teacher(String id) async {
    final data = await api.get('/users/teachers/$id') as Map<String, dynamic>;
    return TeacherRow.fromJson(data);
  }

  Future<TeacherAttendanceSummary> teacherAttendance(String id, DateTime month) async {
    final data = await api.get(
      '/staff-attendance/users/$id/summary',
      query: {'month': DateFormat('yyyy-MM').format(month)},
    ) as Map<String, dynamic>;
    return TeacherAttendanceSummary.fromJson(data);
  }

  Future<void> createTeacher(NewTeacher teacher) => api.post('/users/teachers', body: teacher.toJson());

  Future<void> updateTeacher(String id, {required String fullName, required String phone, required String email}) =>
      api.patch('/users/$id', body: teacherUpdateJson(fullName: fullName, phone: phone, email: email));

  Future<void> deactivateTeacher(String id) => api.delete('/users/$id');

  Future<void> activateTeacher(String id) => api.patch('/users/$id/activate');

  // ------------------------------------------------------------------ fees

  Future<FeesOverview> feesOverview() async {
    final data = await api.get('/fees/dashboard') as Map<String, dynamic>;
    return FeesOverview.fromJson(data);
  }

  Future<List<DefaulterRow>> defaulters() async {
    final data = await api.get('/fees/defaulters') as List? ?? const [];
    return data.map((item) => DefaulterRow.fromJson((item as Map).cast<String, dynamic>())).toList();
  }

  Future<List<FeeStructureRow>> feeStructures() async {
    final data = await api.get('/fees/structures') as List? ?? const [];
    return data.map((item) => FeeStructureRow.fromJson((item as Map).cast<String, dynamic>())).toList();
  }

  Future<FeeLedger> feeLedger(String studentId) async {
    final data = await api.get('/fees/students/$studentId/ledger') as Map<String, dynamic>;
    return FeeLedger.fromJson(data);
  }

  Future<PaymentReceipt> recordPayment(NewPayment payment, {required String idempotencyKey}) async {
    final data = await api.post(
      '/fees/payments',
      body: payment.toJson(),
      headers: {'Idempotency-Key': idempotencyKey},
    ) as Map<String, dynamic>;
    return PaymentReceipt.fromJson(data);
  }

  Future<List<int>> receiptPdf(String receiptId) => api.getBytes('/fees/receipts/$receiptId/pdf');

  Future<void> sendReceiptOnWhatsApp(String receiptId) => api.post('/fees/receipts/$receiptId/send-whatsapp');

  /// The web queue's reminder: look up the parent's phone, then send the text.
  Future<void> sendFeeReminder(DefaulterRow row) async {
    final student = await api.get('/students/${row.studentId}') as Map<String, dynamic>;
    await api.post('/whatsapp/send', body: {
      'phone': student['parentPhone'],
      'message': feeReminderMessage(studentName: row.name, balance: row.balance),
    });
  }

  // -------------------------------------------------------------- calendar

  /// Events and holidays overlapping [month], sorted by start date.
  Future<List<CalendarEvent>> calendarMonth(DateTime month) async {
    final data = await api.get('/calendar', query: {'month': DateFormat('yyyy-MM').format(month)}) as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .map((item) => CalendarEvent.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> createCalendarEvent(CalendarEventDraft draft) => api.post('/calendar/events', body: draft.toJson());

  Future<void> updateCalendarEvent(String id, CalendarEventDraft draft) =>
      api.patch('/calendar/events/$id', body: draft.toJson());

  Future<void> deleteCalendarEvent(String id) => api.delete('/calendar/events/$id');

  // ----------------------------------------------------------------- exams

  Future<List<ExamClass>> examClasses() async {
    final data = await api.get('/marks/context') as Map<String, dynamic>;
    return ExamClass.listFromContext(data);
  }

  Future<List<ExamSummary>> exams({String? classId}) async {
    final data = await api.get('/marks/exams', query: classId == null ? null : {'classId': classId});
    return ((data as List?) ?? const [])
        .map((item) => ExamSummary.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<ExamDetail> exam(String examId) async {
    final data = await api.get('/marks/exams/$examId') as Map<String, dynamic>;
    return ExamDetail.fromJson(data);
  }

  Future<ExamSummary> scheduleExam(NewExam exam) async {
    final data = await api.post('/marks/exams', body: exam.toJson()) as Map<String, dynamic>;
    return ExamSummary.fromJson(data);
  }

  // --------------------------------------------------------- school & classes

  Future<SchoolProfile> schoolProfile() async {
    final data = await api.get('/settings/school-profile') as Map<String, dynamic>;
    return SchoolProfile.fromJson(data);
  }

  Future<SchoolProfile> updateSchoolProfile(Map<String, dynamic> body) async {
    final data = await api.patch('/settings/school-profile', body: body) as Map<String, dynamic>;
    return SchoolProfile.fromJson(data);
  }

  /// The name of the school's current academic year, or null when it has none.
  Future<String?> currentAcademicYear() async {
    final data = await api.get('/academic-years/current');
    return data is Map ? data['name'] as String? : null;
  }

  /// This academic year's classes with teacher, subjects and student count.
  Future<List<ClassRow>> classRows() async {
    final data = await api.get('/classes');
    final items = data is List ? data : (data as Map<String, dynamic>)['items'] as List? ?? const [];
    return items.map((item) => ClassRow.fromJson((item as Map).cast<String, dynamic>())).toList();
  }

  Future<ClassRow> classDetail(String id) async {
    final data = await api.get('/classes/$id') as Map<String, dynamic>;
    return ClassRow.fromJson(data);
  }

  Future<ClassStats> classStats(String id) async {
    final data = await api.get('/classes/$id/stats') as Map<String, dynamic>;
    return ClassStats.fromJson(data);
  }

  Future<List<ClassStudent>> classStudents(String id) async {
    final data = await api.get('/classes/$id/students');
    return ((data as List?) ?? const [])
        .map((item) => ClassStudent.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> createClass(ClassDraft draft) => api.post('/classes', body: draft.toJson());

  Future<void> updateClass(String id, ClassDraft draft) => api.patch('/classes/$id', body: draft.toJson(forUpdate: true));

  /// Only the class's subjects. The server keeps the ones that stay and
  /// refuses to remove one that exams, homework or the timetable still use.
  Future<void> updateClassSubjects(String id, List<String> subjects) =>
      api.patch('/classes/$id', body: {'subjects': ClassDraft.uniqueSubjects(subjects)});

  // --------------------------------------------------------------- reports

  Future<AttendanceOverview> attendanceOverview(({String dateFrom, String dateTo}) range) async {
    final data = await api.get('/attendance/dashboard', query: {'dateFrom': range.dateFrom, 'dateTo': range.dateTo})
        as Map<String, dynamic>;
    return AttendanceOverview.fromJson(data);
  }

  Future<List<ClassAttendanceRow>> classAttendance(({String dateFrom, String dateTo}) range) async {
    final data = await api.get('/attendance/report/classes-today', query: {'dateFrom': range.dateFrom, 'dateTo': range.dateTo});
    return ((data as List?) ?? const [])
        .map((item) => ClassAttendanceRow.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  /// WhatsApps the class teachers whose attendance is still pending in [range].
  Future<({int sent, int pending})> nudgePendingTeachers(({String dateFrom, String dateTo}) range) async {
    final data = await api.post('/attendance/report/nudge-pending?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}')
        as Map<String, dynamic>;
    return (sent: (data['sentCount'] as num?)?.toInt() ?? 0, pending: (data['pendingCount'] as num?)?.toInt() ?? 0);
  }

  Future<List<ClassPerformanceRow>> classPerformance() async {
    final data = await api.get('/analytics/classes');
    return ((data as List?) ?? const [])
        .map((item) => ClassPerformanceRow.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Students flagged this month, with every fee signal removed.
  Future<List<StudentRisk>> studentRisks() async {
    final data = await api.get('/analytics/risk-summary') as Map<String, dynamic>;
    return academicRisks(data);
  }

  /// A principal may enter or amend any student's marks.
  Future<void> saveExamResult({required String examId, required String studentId, required double marks, bool isAbsent = false}) =>
      api.patch('/marks/exams/$examId/results', body: {'studentId': studentId, 'marks': marks, 'isAbsent': isAbsent});
}
