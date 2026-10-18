import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/config/feature_flags.dart';

/// The Quick Actions a principal can put on Home.
///
/// The order here is the order the grid draws them in, so a principal's
/// choice never rearranges the tiles they already know.
enum QuickActionKey {
  students,
  teachers,
  attendance,
  fees,
  leave,
  notice,
  payroll,
  calendar,
  exams;

  /// Hidden features must not be offered, let alone restored from an older
  /// selection made while the flag was on.
  bool get available => switch (this) {
        QuickActionKey.payroll => kPayrollEnabled,
        _ => true,
      };
}

/// Which tiles Home shows, remembered on the device.
///
/// The default is the six of the blueprint: everything else is a tap further
/// away in More, never lost. Storage is the keystore rather than plain
/// preferences only because the app already depends on it; nothing here is
/// a secret.
class QuickActionsStore {
  QuickActionsStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _key = 'ss_principal_quick_actions';

  static const defaults = [
    QuickActionKey.students,
    QuickActionKey.teachers,
    QuickActionKey.attendance,
    QuickActionKey.fees,
    QuickActionKey.leave,
    QuickActionKey.notice,
  ];

  static List<QuickActionKey> get all =>
      QuickActionKey.values.where((key) => key.available).toList();

  /// Falls back to the defaults when the keystore cannot be read at all — a
  /// device that will not hand over a preference is no reason for Home to
  /// come up without its shortcuts. A failing [write] is not swallowed the
  /// same way: there the principal is told their choice was not kept.
  Future<List<QuickActionKey>> read() async {
    final String? stored;
    try {
      stored = await _storage.read(key: _key);
    } on Exception {
      return defaults;
    }
    if (stored == null) return defaults;

    final names = stored.split(',').where((name) => name.isNotEmpty).toSet();
    final chosen = all.where((key) => names.contains(key.name)).toList();

    // An empty Quick Actions strip is a dead end, and so is one left empty by
    // a feature that has since been hidden.
    return chosen.isEmpty ? defaults : chosen;
  }

  Future<void> write(List<QuickActionKey> keys) => _storage.write(
        key: _key,
        value: keys.where((key) => key.available).map((key) => key.name).join(','),
      );
}
