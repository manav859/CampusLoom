import 'package:intl/intl.dart';

import '../../../core/api/api_client.dart';
import 'academics_models.dart';
import 'calendar_models.dart';
import 'salary_models.dart';
import 'teacher_models.dart';

class TeacherRepository {
  TeacherRepository(this.api);

  final ApiClient api;

  static final _dateFormat = DateFormat('yyyy-MM-dd');

  Future<PunchStatus> punchStatus() async {
    final data = await api.get('/staff-attendance/me/today') as Map<String, dynamic>;
    return PunchStatus.fromJson(data);
  }

  Future<PunchStatus> punchIn() async {
    final data = await api.post('/staff-attendance/me/punch-in') as Map<String, dynamic>;
    return PunchStatus.fromJson(data);
  }

  Future<PunchStatus> punchOut() async {
    final data = await api.post('/staff-attendance/me/punch-out') as Map<String, dynamic>;
    return PunchStatus.fromJson(data);
  }

  /// The same GET /dashboard the web teacher dashboard reads.
  Future<TeacherDashboard> dashboard() async {
    final data = await api.get('/dashboard') as Map<String, dynamic>;
    return TeacherDashboard.fromJson(data);
  }

  Future<MySalary> mySalary() async {
    final data = await api.get('/payroll/me/slips') as Map<String, dynamic>;
    return MySalary.fromJson(data);
  }

  Future<List<SchedulePeriod>> todaySchedule() async {
    final data = await api.get('/users/me/schedule') as Map<String, dynamic>;
    return ((data['periods'] as List?) ?? const [])
        .map((item) => SchedulePeriod.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Only the classes this teacher is assigned to — the server scopes
  /// GET /classes by role.
  Future<List<ClassOption>> myClasses() async {
    final data = await api.get('/classes');
    final items = data is List ? data : (data as Map<String, dynamic>)['items'] as List? ?? const [];
    return items
        .map((item) => ClassOption.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<AttendanceRoster> roster({required String classId, required DateTime date}) async {
    final data = await api.get(
      '/attendance/roster',
      query: {'classId': classId, 'date': _dateFormat.format(date)},
    ) as Map<String, dynamic>;
    return AttendanceRoster.fromJson(data);
  }

  Future<void> markAttendance({
    required String classId,
    required DateTime date,
    required List<RosterStudent> students,
  }) async {
    await api.post(
      '/attendance/mark',
      body: {
        'classId': classId,
        'date': _dateFormat.format(date),
        'records': students
            .map((student) => {'studentId': student.id, 'status': student.mark.apiValue})
            .toList(),
      },
    );
  }

  // -------------------------------------------------------------- homework

  Future<List<TeachingClass>> homeworkContext() => _teachingClasses('/homework/context');

  Future<List<HomeworkAssignment>> homeworkAssignments({String? classId}) async {
    final data = await api.get(
      '/homework/assignments',
      query: classId == null ? null : {'classId': classId},
    );
    return ((data as List?) ?? const [])
        .map((item) => HomeworkAssignment.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<HomeworkDetail> homeworkAssignment(String assignmentId) async {
    final data = await api.get('/homework/assignments/$assignmentId') as Map<String, dynamic>;
    return HomeworkDetail.fromJson(data);
  }

  Future<void> createHomework({
    required String classId,
    required String subjectId,
    required String title,
    required DateTime dueDate,
    String? description,
  }) async {
    await api.post(
      '/homework/assignments',
      body: {
        'classId': classId,
        'subjectId': subjectId,
        'title': title,
        'dueDate': _dateFormat.format(dueDate),
        if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
      },
    );
  }

  Future<void> updateSubmission({
    required String assignmentId,
    required String studentId,
    required SubmissionStatus status,
  }) async {
    await api.patch(
      '/homework/assignments/$assignmentId/submissions',
      body: {'studentId': studentId, 'status': status.apiValue},
    );
  }

  // ----------------------------------------------------------------- marks

  Future<List<TeachingClass>> marksContext() => _teachingClasses('/marks/context');

  Future<List<ExamSummary>> exams({String? classId}) async {
    final data = await api.get(
      '/marks/exams',
      query: classId == null ? null : {'classId': classId},
    );
    return ((data as List?) ?? const [])
        .map((item) => ExamSummary.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<ExamDetail> exam(String examId) async {
    final data = await api.get('/marks/exams/$examId') as Map<String, dynamic>;
    return ExamDetail.fromJson(data);
  }

  Future<void> updateExamResult({
    required String examId,
    required String studentId,
    required double marks,
    bool isAbsent = false,
  }) async {
    await api.patch(
      '/marks/exams/$examId/results',
      body: {'studentId': studentId, 'marks': marks, 'isAbsent': isAbsent},
    );
  }

  // -------------------------------------------------------------- students

  Future<List<StudentListItem>> students({String? classId, String? search}) async {
    final data = await api.get('/students', query: {
      if (classId != null) 'classId': classId,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      'limit': 100,
    }) as Map<String, dynamic>;

    return ((data['items'] as List?) ?? const [])
        .map((item) => StudentListItem.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<StudentProfile> student(String id) async {
    final data = await api.get('/students/$id') as Map<String, dynamic>;
    // The server nests the record for some roles and returns it flat for others.
    final record = (data['student'] as Map?)?.cast<String, dynamic>() ?? data;
    return StudentProfile.fromJson(record);
  }

  Future<FocusResult> studentsNeedingFocus({String? classId}) async {
    final data = await api.get(
      '/students/needing-focus',
      query: classId == null ? null : {'classId': classId},
    ) as Map<String, dynamic>;
    return FocusResult.fromJson(data);
  }

  // -------------------------------------------------------------- calendar

  /// Events and holidays overlapping [month], sorted by start date.
  Future<List<CalendarEvent>> calendarMonth(DateTime month) async {
    final data = await api.get(
      '/calendar',
      query: {'month': DateFormat('yyyy-MM').format(month)},
    ) as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .map((item) => CalendarEvent.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<TeachingClass>> _teachingClasses(String path) async {
    final data = await api.get(path) as Map<String, dynamic>;
    return ((data['classes'] as List?) ?? const [])
        .map((item) => TeachingClass.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }
}
