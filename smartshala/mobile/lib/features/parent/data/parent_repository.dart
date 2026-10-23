import '../../../core/api/api_client.dart';

/// Reads the parent-facing API. Empty for now (Phase 0 scaffolding): each
/// phase adds the calls it needs — children list, home, attendance, fees — the
/// same way [TeacherRepository] grew.
class ParentRepository {
  ParentRepository(this.api);

  final ApiClient api;
}
