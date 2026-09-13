import 'package:intl/intl.dart';

import '../../../core/api/api_client.dart';
import '../../../core/data/dashboard_models.dart';
import 'principal_dashboard.dart';

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
}
