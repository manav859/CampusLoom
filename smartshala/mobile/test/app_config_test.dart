import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/config/app_config.dart';

/// A build that quietly falls back to localhost is unusable on a real phone —
/// the whole app looks offline. The default has to stay the deployed backend.
void main() {
  test('both flavors default to the deployed backend', () {
    for (final flavor in AppFlavor.values) {
      final config = AppConfig.forFlavor(flavor);
      expect(config.apiBaseUrl, AppConfig.productionBaseUrl);
      expect(config.apiBaseUrl, startsWith('https://'));
      expect(config.isUsingCustomBackend, isFalse);
    }
  });

  test('an overridden base URL is flagged as custom', () {
    const config = AppConfig(
      flavor: AppFlavor.teacher,
      apiBaseUrl: 'http://10.0.2.2:4000',
    );
    expect(config.isUsingCustomBackend, isTrue);
  });

  test('each binary accepts only its own roles', () {
    expect(AppConfig.forFlavor(AppFlavor.teacher).allowedRoles, ['TEACHER']);
    expect(AppConfig.forFlavor(AppFlavor.principal).allowedRoles, ['PRINCIPAL', 'ADMIN']);
  });
}
