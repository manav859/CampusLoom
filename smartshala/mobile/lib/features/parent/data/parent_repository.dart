import 'package:intl/intl.dart';

import '../../../core/api/api_client.dart';
import '../../../core/data/calendar_models.dart';
import '../../../core/data/messages_models.dart';
import 'parent_models.dart';

/// Reads the parent-facing API. Each phase adds the calls it needs — home,
/// attendance, fees — the same way [TeacherRepository] grew.
class ParentRepository {
  ParentRepository(this.api);

  final ApiClient api;

  /// The children this signed-in parent may view.
  Future<List<ParentChild>> children() async {
    final data = await api.get('/parent/children') as Map<String, dynamic>;
    final list = (data['children'] as List? ?? const []).cast<Map<String, dynamic>>();
    return list.map(ParentChild.fromJson).toList();
  }

  /// The Home aggregate for one child — their details and this month's attendance.
  Future<ChildHome> home(String childId) async {
    final data = await api.get('/parent/children/$childId/home') as Map<String, dynamic>;
    return ChildHome.fromJson(data);
  }

  /// One child's attendance for [month] (YYYY-MM), or the current month when null.
  Future<MonthlyAttendance> attendance(String childId, {String? month}) async {
    final data = await api.get(
      '/parent/children/$childId/attendance',
      query: month == null ? null : {'month': month},
    ) as Map<String, dynamic>;
    return MonthlyAttendance.fromJson(data);
  }

  /// One child's exam performance.
  Future<ChildAcademics> academics(String childId) async {
    final data = await api.get('/parent/children/$childId/academics') as Map<String, dynamic>;
    return ChildAcademics.fromJson(data);
  }

  /// One child's homework assignments with submission state.
  Future<List<HomeworkItem>> homework(String childId) async {
    final data = await api.get('/parent/children/$childId/homework') as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(HomeworkItem.fromJson)
        .toList();
  }

  /// One child's fees — summary, assignments and payment history.
  Future<ChildFees> fees(String childId) async {
    final data = await api.get('/parent/children/$childId/fees') as Map<String, dynamic>;
    return ChildFees.fromJson(data);
  }

  /// Mint an external Razorpay pay link for one outstanding fee assignment.
  Future<String> feePayLink(String childId, String assignmentId) async {
    final data = await api.post(
      '/parent/children/$childId/fees/pay-link',
      body: {'assignmentId': assignmentId},
    ) as Map<String, dynamic>;
    return data['payUrl'] as String;
  }

  /// The PDF bytes of one payment's receipt.
  Future<List<int>> feeReceiptPdf(String childId, String paymentId) =>
      api.getBytes('/parent/children/$childId/fees/receipts/$paymentId/pdf');

  /// The school calendar (events + holidays) overlapping [month].
  Future<List<CalendarEvent>> calendar(DateTime month) async {
    final data = await api.get(
      '/parent/calendar',
      query: {'month': DateFormat('yyyy-MM').format(month)},
    ) as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .map((item) => CalendarEvent.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  /// The school's parent-facing announcements, newest first.
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async {
    final data = await api.get(
      '/parent/announcements',
      query: {'limit': '$limit', 'offset': '$offset'},
    ) as Map<String, dynamic>;
    return AnnouncementPage.fromJson(data);
  }

  /// The teacher/principal messages sent to one child's parents, newest first.
  Future<List<ParentMessage>> childMessages(String childId) async {
    final data = await api.get('/parent/children/$childId/messages') as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(ParentMessage.fromJson)
        .toList();
  }

  /// One child's documents — report cards, certificates and the like.
  Future<List<ParentDocument>> documents(String childId) async {
    final data = await api.get('/parent/children/$childId/documents') as Map<String, dynamic>;
    return ((data['documents'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(ParentDocument.fromJson)
        .toList();
  }

  /// A short-lived download URL for one of the child's documents.
  Future<String> documentDownloadUrl(String childId, String documentId) async {
    final data = await api.get(
      '/parent/children/$childId/documents/$documentId/download',
    ) as Map<String, dynamic>;
    return data['downloadUrl'] as String;
  }

  /// The leave requests this parent has raised for one child, newest first.
  Future<List<ParentLeaveRequest>> leaveRequests(String childId) async {
    final data = await api.get('/parent/children/$childId/leave') as Map<String, dynamic>;
    return ((data['requests'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(ParentLeaveRequest.fromJson)
        .toList();
  }

  /// Raise a new leave request for one child. Dates are YYYY-MM-DD.
  Future<ParentLeaveRequest> submitLeave(
    String childId, {
    required String fromDate,
    required String toDate,
    required String reason,
  }) async {
    final data = await api.post(
      '/parent/children/$childId/leave',
      body: {'fromDate': fromDate, 'toDate': toDate, 'reason': reason},
    ) as Map<String, dynamic>;
    return ParentLeaveRequest.fromJson(data);
  }
}
