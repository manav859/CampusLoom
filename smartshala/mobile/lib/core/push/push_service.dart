import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../config/app_config.dart';
import 'push_message.dart';
import 'push_messaging.dart';

/// Push notifications, from the permission prompt to the screen a tap opens.
///
/// Started when a session begins and stopped when it ends, so a device is only
/// ever registered against the account currently signed in to it. Inert until
/// `push_config.dart` names a Firebase project, which is what
/// [PushMessaging.initialize] reports. Every failure
/// here is swallowed: a notification that cannot be set up must not keep anyone
/// out of the app.
///
/// Two things are published for the UI to pick up, both as [ChangeNotifier]
/// fields rather than streams, so a listener that attaches late still sees
/// them — the cold-start case, where the notification is read before the shell
/// has been built:
///   * [pendingTarget] — the screen a tapped notification asked for.
///   * [pendingBanner] — an Android foreground notification to show in-app.
class PushService extends ChangeNotifier {
  PushService({
    required ApiClient api,
    required AppConfig config,
    PushMessaging? messaging,
    bool? showsInAppBanner,
  })
      // Initializing formals cannot be used here: the fields are private and
      // Dart forbids private named parameters. Same as ApiClient.
      // ignore: prefer_initializing_formals
      : _api = api,
        // ignore: prefer_initializing_formals
        _config = config,
        _messaging = messaging ?? FirebasePushMessaging(),
        // iOS draws its own banner over the app; Android draws nothing while
        // the app is in the foreground, so the app has to say something itself.
        _showsInAppBanner = showsInAppBanner ?? Platform.isAndroid;

  final ApiClient _api;
  final AppConfig _config;
  final PushMessaging _messaging;
  final bool _showsInAppBanner;

  final List<StreamSubscription<void>> _subscriptions = [];

  bool _started = false;
  String? _fid;
  PushTarget? _pendingTarget;
  PushMessage? _pendingBanner;

  /// True once this install is registered with the server and listening. False
  /// while push is unconfigured, or after the user has refused the permission.
  bool get isActive => _fid != null;

  PushTarget? get pendingTarget => _pendingTarget;
  PushMessage? get pendingBanner => _pendingBanner;

  /// Read once, by the shell that acts on it.
  PushTarget? takePendingTarget() {
    final target = _pendingTarget;
    _pendingTarget = null;
    return target;
  }

  PushMessage? takePendingBanner() {
    final banner = _pendingBanner;
    _pendingBanner = null;
    return banner;
  }

  /// Called when a session begins. Safe to call again; it does nothing the
  /// second time.
  Future<void> start() async {
    if (_started) return;
    _started = true;

    try {
      // The single gate: initialize reports false while PushConfig has no
      // Firebase project in it, which is how the apps ship today.
      if (!await _messaging.initialize(_config.flavor)) return;

      // A refusal is final for this launch. The next cold start asks again,
      // which on iOS is a no-op and on Android 13+ is the one more prompt the
      // OS allows.
      if (!await _messaging.requestPermission()) return;

      // Subscribed before register(), because the installation ID is delivered
      // on this stream and a late listener would miss it.
      _subscriptions.add(_messaging.onRegistered.listen(_register));
      _subscriptions.add(_messaging.onMessage.listen(_onForegroundMessage));
      _subscriptions.add(_messaging.onMessageOpened.listen(_onOpened));

      await _messaging.register();

      // The notification that launched the app. Read after the listeners are
      // attached so nothing arriving in between is lost.
      final initial = await _messaging.initialMessage();
      if (initial != null) _onOpened(initial);
    } catch (error, stack) {
      _report('could not be started', error, stack);
    }
  }

  /// Called on sign-out, before the session is cleared — the unregister call
  /// needs the access token that is about to go.
  Future<void> stop() async {
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();

    final fid = _fid;
    _fid = null;
    _pendingTarget = null;
    _pendingBanner = null;
    _started = false;

    if (fid == null) return;

    // Sign-out waits for both of these, so neither may take the ApiClient's
    // 30-second connect budget: a teacher signing out on bad mobile data would
    // be left staring at the screen. Giving up costs nothing — a registration
    // the server keeps stops working on its own, because the next send to it
    // fails and the row is deleted then.
    await _bounded('device could not be unregistered', () => _api.delete('/push/devices', body: {'fid': fid}));
    await _bounded('installation could not be unregistered', _messaging.unregister);
  }

  static const _signOutBudget = Duration(seconds: 5);

  Future<void> _bounded(String what, Future<void> Function() work) async {
    try {
      await work().timeout(_signOutBudget);
    } catch (error, stack) {
      _report(what, error, stack);
    }
  }

  Future<void> _register(String fid) async {
    try {
      await _api.post('/push/devices', body: {
        'fid': fid,
        'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
      });
      _fid = fid;
      notifyListeners();
    } catch (error, stack) {
      _report('device could not be registered', error, stack);
    }
  }

  void _onForegroundMessage(PushMessage message) {
    if (!_showsInAppBanner) return;
    _pendingBanner = message;
    notifyListeners();
  }

  void _onOpened(PushMessage message) {
    final target = message.target;
    if (target == null) return;
    _pendingTarget = target;
    notifyListeners();
  }

  void _report(String what, Object error, StackTrace stack) {
    if (kDebugMode) debugPrint('Push notifications: $what — $error\n$stack');
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _subscriptions.clear();
    super.dispose();
  }
}
