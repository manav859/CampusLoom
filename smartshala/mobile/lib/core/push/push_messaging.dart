import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../config/app_config.dart';
import 'push_config.dart';
import 'push_message.dart';

/// Everything [PushService] needs from the platform, behind one interface so
/// the service can be driven in a test. Nothing above this file imports
/// firebase_messaging — a unit test cannot start Firebase at all.
abstract class PushMessaging {
  /// Starts Firebase for this flavor. False when the project is not configured,
  /// which is the state the apps ship in until the owner fills in
  /// [PushConfig].
  Future<bool> initialize(AppFlavor flavor);

  /// Shows the system prompt (iOS always, Android 13+). False if the user says
  /// no, in which case nothing else here is worth calling.
  Future<bool> requestPermission();

  /// Registers this app install with FCM. The resulting Firebase Installation
  /// ID arrives on [onRegistered] rather than being returned — registration is
  /// asynchronous on the platform side.
  Future<void> register();

  /// The Firebase Installation ID of this app install, on registration and
  /// again whenever the platform replaces it. This is what the server sends to.
  Stream<String> get onRegistered;

  /// Arrives while the app is open and on screen.
  Stream<PushMessage> get onMessage;

  /// The user tapped a notification while the app was in the background.
  Stream<PushMessage> get onMessageOpened;

  /// The notification that launched the app from cold, if any.
  Future<PushMessage?> initialMessage();

  /// Sign-out: the next person on this device must not get the last one's
  /// notifications. The server row is deleted separately.
  Future<void> unregister();
}

class FirebasePushMessaging implements PushMessaging {
  /// How long to wait for iOS to hand over the APNs token. FCM registration on
  /// Apple platforms is only valid once APNs has answered, and that happens a
  /// moment after launch.
  static const _apnsTimeout = Duration(seconds: 10);
  static const _apnsPollInterval = Duration(milliseconds: 250);

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  @override
  Future<bool> initialize(AppFlavor flavor) async {
    final options = PushConfig.optionsFor(flavor);
    if (options == null) return false;

    // A hot restart in debug re-runs this against an already-started Firebase.
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: options);
    }

    // iOS shows its own banner for a notification that arrives while the app
    // is open; Android does not, which is why PushService draws one there.
    if (Platform.isIOS) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }
    return true;
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<void> register() async {
    // Registering before APNs has answered produces an installation iOS cannot
    // deliver to, and nothing reports the failure afterwards. Giving up after
    // the timeout is deliberate: the next app start tries again, and a device
    // that never gets an APNs token would never register either way.
    if (Platform.isIOS && !await _waitForApnsToken()) return;
    await _messaging.register();
  }

  Future<bool> _waitForApnsToken() async {
    final deadline = DateTime.now().add(_apnsTimeout);
    while (DateTime.now().isBefore(deadline)) {
      if (await _messaging.getAPNSToken() != null) return true;
      await Future<void>.delayed(_apnsPollInterval);
    }
    return false;
  }

  @override
  Stream<String> get onRegistered => _messaging.onRegistered;

  @override
  Stream<PushMessage> get onMessage => FirebaseMessaging.onMessage.map(_toPushMessage);

  @override
  Stream<PushMessage> get onMessageOpened =>
      FirebaseMessaging.onMessageOpenedApp.map(_toPushMessage);

  @override
  Future<PushMessage?> initialMessage() async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _toPushMessage(message);
  }

  @override
  Future<void> unregister() => _messaging.unregister();
}

PushMessage _toPushMessage(RemoteMessage message) => PushMessage(
      title: message.notification?.title,
      body: message.notification?.body,
      // The payload is strings on the wire; `dynamic` is only how the plugin
      // types the decoded map.
      data: message.data.map((key, value) => MapEntry(key, '$value')),
    );
