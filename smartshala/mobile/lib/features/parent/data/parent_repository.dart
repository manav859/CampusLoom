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
}
