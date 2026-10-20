import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';

import '../config/app_config.dart';

/// The Firebase project the two apps send and receive notifications through.
///
/// **This is the one file the owner has to fill in.** Until it is, every value
/// below is empty, [isConfigured] is false, and the apps run exactly as they do
/// today: no permission prompt, no token, no notifications, nothing to crash.
///
/// The values are not secrets — they ship inside every APK and IPA, and the
/// Android keys are restricted to the signing certificate and package name by
/// Firebase itself. They are kept here rather than in `google-services.json`
/// and `GoogleService-Info.plist` because this repository builds four
/// applications (two flavors on two platforms) from one target, and a native
/// config file per flavor needs a copy step in Gradle and an Xcode build phase.
/// Passing [FirebaseOptions] from Dart, where the flavor is already known,
/// replaces both.
///
/// Where each value comes from (Firebase console → Project settings → General):
///   projectId           → "Project ID"
///   messagingSenderId   → "Project number"
///   androidApiKey       → the Android app's "Web API key" / google-services.json
///                         `api_key[0].current_key`
///   iosApiKey           → the iOS app's GoogleService-Info.plist `API_KEY`
///   `<flavor><platform>AppId` → each app's "App ID", e.g. 1:123456789:android:abc…
///
/// See docs/product/PUSH_NOTIFICATIONS.md for the full walkthrough.
abstract final class PushConfig {
  /// Shared by all four apps: they live in one Firebase project.
  static const projectId = 'smartshala-a9822';
  static const messagingSenderId = '937759986920';

  static const androidApiKey = 'AIzaSyCAbQnUIlcdlv8gT4Ja5bXS09VVZJew_VM';
  static const iosApiKey = 'AIzaSyBqMSK4ihU_optqirXl0SpNnBkfKzwMSbA';

  static const principalAndroidAppId = '1:937759986920:android:baa059783846002860255d';
  static const principalIosAppId = '1:937759986920:ios:db7cbe5e2545c43d60255d';
  static const teacherAndroidAppId = '1:937759986920:android:28ed7bb80db4ad9a60255d';
  static const teacherIosAppId = '1:937759986920:ios:209b1af85d2638f760255d';

  /// Must match the Android notification channel the app creates in
  /// MainActivity.kt and the `channel_id` the backend sends.
  static const androidChannelId = 'smartshala_default';

  static String bundleIdFor(AppFlavor flavor) =>
      flavor == AppFlavor.principal ? 'com.smartshala.principal' : 'com.smartshala.teacher';

  /// False on every platform but Android and iOS: the apps ship nowhere else,
  /// and a Flutter test runs on neither.
  static bool get isSupportedPlatform => Platform.isAndroid || Platform.isIOS;

  /// True only when this flavor can actually reach the project on this
  /// platform. Anything missing disables push rather than failing a build.
  static bool isConfiguredFor(AppFlavor flavor) {
    if (projectId.isEmpty || messagingSenderId.isEmpty) return false;
    if (!isSupportedPlatform) return false;
    return _apiKey.isNotEmpty && _appId(flavor).isNotEmpty;
  }

  static FirebaseOptions? optionsFor(AppFlavor flavor) {
    if (!isConfiguredFor(flavor)) return null;

    return FirebaseOptions(
      apiKey: _apiKey,
      appId: _appId(flavor),
      messagingSenderId: messagingSenderId,
      projectId: projectId,
      iosBundleId: Platform.isIOS ? bundleIdFor(flavor) : null,
    );
  }

  static String get _apiKey => Platform.isIOS ? iosApiKey : androidApiKey;

  static String _appId(AppFlavor flavor) => switch ((flavor, Platform.isIOS)) {
        (AppFlavor.principal, false) => principalAndroidAppId,
        (AppFlavor.principal, true) => principalIosAppId,
        (AppFlavor.teacher, false) => teacherAndroidAppId,
        (AppFlavor.teacher, true) => teacherIosAppId,
      };
}
