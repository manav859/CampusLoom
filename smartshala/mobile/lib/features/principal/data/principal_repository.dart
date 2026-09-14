import 'package:intl/intl.dart';

import '../../../core/api/api_client.dart';
import '../../../core/data/dashboard_models.dart';
import 'principal_dashboard.dart';
import 'student_models.dart';
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
}
