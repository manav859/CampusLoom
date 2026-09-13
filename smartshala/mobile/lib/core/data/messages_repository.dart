import 'package:intl/intl.dart';

import '../api/api_client.dart';
import 'messages_models.dart';

/// Leave and announcements for both binaries. Every list call returns its own
/// tile counts, so a screen never issues a second request to keep its header
/// in step with the list below it.
class MessagesRepository {
  MessagesRepository(this.api);

  final ApiClient api;

  static final _dateFormat = DateFormat('yyyy-MM-dd');

  Future<LeavePage> myLeave({LeaveStatus? status, int limit = 20, int offset = 0}) async {
    final data = await api.get('/leave/requests/me', query: {
      if (status != null) 'status': status.apiValue,
      'limit': limit,
      'offset': offset,
    }) as Map<String, dynamic>;
    return LeavePage.fromJson(data);
  }

  Future<LeavePage> schoolLeave({
    LeaveStatus? status,
    String? search,
    int limit = 20,
    int offset = 0,
  }) async {
    final data = await api.get('/leave/requests', query: {
      if (status != null) 'status': status.apiValue,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      'limit': limit,
      'offset': offset,
    }) as Map<String, dynamic>;
    return LeavePage.fromJson(data);
  }

  Future<LeaveRequest> applyForLeave({
    required LeaveType type,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
    LeaveAttachment? attachment,
  }) async {
    final fields = {
      'type': type.apiValue,
      'fromDate': _dateFormat.format(fromDate),
      'toDate': _dateFormat.format(toDate),
      'reason': reason.trim(),
    };

    // Only pay for a multipart body when there is actually a file; the plain
    // JSON path stays the common case.
    final data = attachment == null
        ? await api.post('/leave/requests', body: fields)
        : await api.postMultipart(
            '/leave/requests',
            fields: fields,
            fileField: 'attachment',
            filePath: attachment.path,
            fileName: attachment.name,
          );

    return LeaveRequest.fromJson(data as Map<String, dynamic>);
  }

  Future<LeaveRequest> decideLeave({
    required String id,
    required bool approve,
    String? note,
  }) async {
    final data = await api.patch('/leave/requests/$id/decision', body: {
      'status': approve ? 'APPROVED' : 'REJECTED',
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    }) as Map<String, dynamic>;
    return LeaveRequest.fromJson(data);
  }

  Future<LeaveRequest> withdrawLeave(String id) async {
    final data = await api.patch('/leave/requests/$id/cancel') as Map<String, dynamic>;
    return LeaveRequest.fromJson(data);
  }

  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async {
    final data = await api.get(
      '/announcements',
      query: {'limit': limit, 'offset': offset},
    ) as Map<String, dynamic>;
    return AnnouncementPage.fromJson(data);
  }

  Future<Announcement> createAnnouncement({
    required String title,
    required String body,
    required AnnouncementAudience audience,
    required AnnouncementPriority priority,
  }) async {
    final data = await api.post('/announcements', body: {
      'title': title.trim(),
      'body': body.trim(),
      'audience': audience.apiValue,
      'priority': priority.apiValue,
    }) as Map<String, dynamic>;
    return Announcement.fromJson(data);
  }

  Future<void> markAnnouncementRead(String id) => api.post('/announcements/$id/read');
}
