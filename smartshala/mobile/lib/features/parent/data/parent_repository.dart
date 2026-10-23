import '../../../core/api/api_client.dart';
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
}
