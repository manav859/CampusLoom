/// Which screen a tapped notification opens. The names are the contract with
/// the backend — `src/modules/push/push.messages.ts` sends exactly these in the
/// payload's `target` field.
enum PushTarget {
  home,
  messages,
  calendar,
  /// The principal's Leave Approval screen. The teacher app has no such screen
  /// and is never sent this, but falls back to Messages if it ever is.
  leaveApproval;

  static PushTarget? parse(String? value) => switch (value) {
        'home' => PushTarget.home,
        'messages' => PushTarget.messages,
        'calendar' => PushTarget.calendar,
        'leave_approval' => PushTarget.leaveApproval,
        _ => null,
      };
}

/// One notification, flattened out of the platform message so nothing above
/// this layer depends on firebase_messaging.
class PushMessage {
  const PushMessage({this.title, this.body, this.data = const {}});

  final String? title;
  final String? body;
  final Map<String, String> data;

  /// Null for a notification whose target the server did not set or this
  /// version of the app does not know — the tap then just opens the app.
  PushTarget? get target => PushTarget.parse(data['target']);

  /// What a foreground notification shows in the in-app banner.
  String get bannerText {
    final heading = title?.trim() ?? '';
    final detail = body?.trim() ?? '';
    if (heading.isEmpty) return detail;
    if (detail.isEmpty) return heading;
    return '$heading — $detail';
  }
}
