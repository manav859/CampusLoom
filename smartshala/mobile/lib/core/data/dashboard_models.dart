import 'package:intl/intl.dart';

/// Shared by the principal and teacher dashboards. Everything here ports a
/// piece of the web dashboard (frontend/src/features/dashboard/DashboardHome.tsx
/// and lib/formatters.ts) so both apps and the web print the same numbers in
/// the same words. Change one side, change the other.

int _int(Object? value) =>
    value is num ? value.toInt() : int.tryParse('$value') ?? 0;

/// Fee figures arrive as numbers or as Prisma Decimal strings.
double _double(Object? value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

/// The web puts a non-breaking space between ₹ and the amount.
final _nbsp = String.fromCharCode(0x00A0);

final _groupedInr = NumberFormat.decimalPattern('en_IN');

/// The web's `formatINR`: "₹ 12.5 Lakh" and "₹ 2 Crore" when [compact], else
/// "₹ 12,345" with Indian digit grouping. The space is a non-breaking space.
String formatInr(num value, {bool compact = true, int fractionDigits = 0}) {
  final amount = value.toDouble();
  final absolute = amount.abs();

  String trimZeroes(String text) => text
      .replaceFirst(RegExp(r'\.0+$'), '')
      .replaceFirstMapped(RegExp(r'(\.\d*[1-9])0+$'), (m) => m[1]!);

  if (compact && absolute >= 10000000) {
    return '₹$_nbsp${trimZeroes((amount / 10000000).toStringAsFixed(1))} Crore';
  }
  if (compact && absolute >= 100000) {
    return '₹$_nbsp${trimZeroes((amount / 100000).toStringAsFixed(1))} Lakh';
  }

  final format = fractionDigits == 0
      ? _groupedInr
      : NumberFormat.decimalPatternDigits(
          locale: 'en_IN',
          decimalDigits: fractionDigits,
        );
  return '₹$_nbsp${format.format(fractionDigits == 0 ? amount.round() : amount)}';
}

/// One class in today's attendance report (GET /dashboard `attendance`).
class ClassAttendance {
  const ClassAttendance({
    required this.className,
    required this.marked,
    required this.totalStudents,
    required this.present,
    required this.absent,
    required this.attendancePercentage,
    this.classId,
  });

  final String? classId;
  final String className;
  final bool marked;
  final int totalStudents;
  final int present;
  final int absent;
  final int attendancePercentage;

  factory ClassAttendance.fromJson(Map<String, dynamic> json) =>
      ClassAttendance(
        classId: json['classId'] as String?,
        className: json['className'] as String? ?? '—',
        marked: json['marked'] as bool? ?? false,
        totalStudents: _int(json['totalStudents']),
        present: _int(json['present']),
        absent: _int(json['absent']),
        attendancePercentage:
            (json['attendancePercentage'] as num?)?.round() ?? 0,
      );

  static List<ClassAttendance> listFrom(Object? value) =>
      ((value as List?) ?? const [])
          .map(
            (item) =>
                ClassAttendance.fromJson((item as Map).cast<String, dynamic>()),
          )
          .toList();
}

enum AlertSeverity { high, medium, low }

/// A raw item from GET /dashboard `alerts`: a pending-attendance or homework
/// nudge for teachers, a behaviour incident or student risk for principals.
class DashboardAlert {
  const DashboardAlert({
    required this.type,
    required this.message,
    required this.severity,
    this.studentId,
    this.studentName,
    this.flags = const [],
  });

  final String type;
  final String? message;
  final AlertSeverity severity;
  final String? studentId;
  final String? studentName;
  final List<String> flags;

  factory DashboardAlert.fromJson(Map<String, dynamic> json) => DashboardAlert(
    type: json['type'] as String? ?? '',
    message: json['message'] as String?,
    studentId: json['studentId'] as String?,
    studentName: json['studentName'] as String?,
    flags: ((json['flags'] as List?) ?? const [])
        .map((flag) => '$flag')
        .toList(),
    severity: switch (json['severity'] as String?) {
      'HIGH' => AlertSeverity.high,
      'MEDIUM' => AlertSeverity.medium,
      _ => AlertSeverity.low,
    },
  );

  static List<DashboardAlert> listFrom(Object? value) =>
      ((value as List?) ?? const [])
          .map(
            (item) =>
                DashboardAlert.fromJson((item as Map).cast<String, dynamic>()),
          )
          .toList();
}

/// A student with a pending fee balance (GET /dashboard `defaulters`, principal only).
class FeeDefaulter {
  const FeeDefaulter({
    required this.studentId,
    required this.name,
    required this.className,
    required this.balance,
    required this.daysOverdue,
  });

  final String studentId;
  final String name;
  final String className;
  final double balance;
  final int daysOverdue;

  factory FeeDefaulter.fromJson(Map<String, dynamic> json) => FeeDefaulter(
    studentId: json['studentId'] as String? ?? '',
    name: json['name'] as String? ?? '—',
    className: json['class'] as String? ?? '',
    balance: _double(json['balance']),
    daysOverdue: _int(json['daysOverdue']),
  );

  static List<FeeDefaulter> listFrom(Object? value) =>
      ((value as List?) ?? const [])
          .map(
            (item) =>
                FeeDefaulter.fromJson((item as Map).cast<String, dynamic>()),
          )
          .toList();
}

/// The web AlertPanel's severity badge: Critical / High / Medium.
enum ActionLevel { critical, high, medium }

/// What an action alert is about, so a screen can decide where a tap goes.
enum ActionKind {
  feeDefaulter,
  attendancePending,
  homeworkPending,
  student,
  lowAttendance,
  other,
}

class ActionAlert {
  const ActionAlert({
    required this.label,
    required this.level,
    required this.kind,
    this.detail,
    this.studentId,
  });

  final String label;
  final String? detail;
  final ActionLevel level;
  final ActionKind kind;
  final String? studentId;

  /// The web colours an alert red only when it is critical-toned ("danger").
  bool get isDanger => level == ActionLevel.critical;
}

/// The web dashboard's `actionAlerts`, in the same order and with the same
/// caps: two fee defaulters, three dashboard alerts, two low-attendance
/// classes, six in all.
List<ActionAlert> buildActionAlerts({
  List<FeeDefaulter> defaulters = const [],
  required List<DashboardAlert> alerts,
  required List<ClassAttendance> attendance,
}) {
  final items = <ActionAlert>[
    for (final item in defaulters.take(2))
      ActionAlert(
        label:
            '${item.name} has ${formatInr(item.balance, compact: false)} pending',
        detail: '${item.className} - ${item.daysOverdue} days overdue',
        level: item.daysOverdue >= 30
            ? ActionLevel.critical
            : item.daysOverdue > 0
            ? ActionLevel.high
            : ActionLevel.medium,
        kind: ActionKind.feeDefaulter,
        studentId: item.studentId,
      ),
    for (final alert in alerts.take(3))
      ActionAlert(
        label:
            alert.type == 'BEHAVIOUR_INCIDENT' &&
                alert.studentName != null &&
                alert.message != null
            ? '${alert.studentName}: ${alert.message}'
            : alert.studentName ?? alert.message ?? 'Attendance action needed',
        // The web falls back to the raw severity ("MEDIUM") here; the badge
        // already says it, so the app leaves the line empty instead.
        detail: alert.flags.isEmpty ? null : alert.flags.join(', '),
        level: switch (alert.severity) {
          AlertSeverity.high => ActionLevel.critical,
          AlertSeverity.medium => ActionLevel.high,
          AlertSeverity.low => ActionLevel.medium,
        },
        kind: switch (alert.type) {
          'ATTENDANCE_PENDING' => ActionKind.attendancePending,
          'HOMEWORK_PENDING' => ActionKind.homeworkPending,
          _ => alert.studentId != null ? ActionKind.student : ActionKind.other,
        },
        studentId: alert.studentId,
      ),
    for (final item
        in attendance
            .where((item) => item.marked && item.attendancePercentage < 75)
            .take(2))
      ActionAlert(
        label: '${item.className} low attendance',
        detail: '${item.attendancePercentage}% attendance today',
        level: item.attendancePercentage < 60
            ? ActionLevel.critical
            : ActionLevel.high,
        kind: ActionKind.lowAttendance,
      ),
  ];

  return items.take(6).toList();
}

enum ActivityType { attendance, fee, alert, message }

/// One line of the web dashboard's activity feed (GET /activity-logs).
class ActivityEntry {
  const ActivityEntry({
    required this.id,
    required this.text,
    required this.createdAt,
    required this.type,
    required this.actorName,
  });

  final String id;
  final String text;
  final DateTime? createdAt;
  final ActivityType type;
  final String actorName;

  factory ActivityEntry.fromJson(Map<String, dynamic> json) {
    final entityType = json['entityType'] as String? ?? '';
    final action = json['action'] as String? ?? '';
    final summary = json['summary'] as String? ?? '';

    return ActivityEntry(
      id: json['id'] as String? ?? '',
      text: _activityDescription(json, entityType, action, summary),
      createdAt: json['createdAt'] is String
          ? DateTime.tryParse(json['createdAt'] as String)?.toLocal()
          : null,
      type: switch (entityType) {
        'ATTENDANCE' => ActivityType.attendance,
        'FEE' || 'FEES' => ActivityType.fee,
        _ => action == 'DELETE' ? ActivityType.alert : ActivityType.message,
      },
      actorName: ((json['actor'] as Map?)?['fullName'] as String?) ?? 'System',
    );
  }
}

/// The web's `humanizeConstant`: "FEE_ADJUSTMENT" -> "Fee adjustment"; mixed
/// case passes through untouched.
String humanizeConstant(String value) {
  final trimmed = value.trim();
  if (!RegExp(r'^[A-Z0-9_\s-]+$').hasMatch(trimmed)) return trimmed;
  final words = trimmed
      .replaceAll(RegExp(r'[_-]+'), ' ')
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList();
  if (words.isEmpty) return trimmed;
  return [
    words.first[0].toUpperCase() + words.first.substring(1),
    ...words.skip(1),
  ].join(' ');
}

String _activityDescription(
  Map<String, dynamic> json,
  String entityType,
  String action,
  String summary,
) {
  final looksLikeRoute = [
    ' /',
    ' PATCH ',
    ' POST ',
    ' PUT ',
    ' DELETE ',
  ].any(summary.contains);
  if (!looksLikeRoute) return summary;

  final actionLabel = switch (action) {
    'CREATE_OR_RUN' => 'Create',
    'REPLACE' => 'Update',
    _ => humanizeConstant(action),
  };
  var module = humanizeConstant(entityType);
  if (module.toLowerCase() == 'students') module = 'Student';

  Map<String, dynamic> asMap(Object? value) =>
      (value as Map?)?.cast<String, dynamic>() ?? const {};
  final after = asMap(json['afterJson']);
  final body = asMap(after['body']);
  final before = asMap(json['beforeJson']);
  final target =
      [
        after['fullName'],
        body['fullName'],
        before['fullName'],
        after['name'],
        body['name'],
        body['studentName'],
        body['title'],
      ].whereType<String>().firstWhere(
        (value) => value.trim().isNotEmpty,
        orElse: () => '',
      );

  final lower = actionLabel.toLowerCase();
  final capitalised = lower.isEmpty
      ? lower
      : lower[0].toUpperCase() + lower.substring(1);
  return '$capitalised ${module.toLowerCase()}${target.isEmpty ? '' : ' $target'}';
}

/// The web's `relativeTime`: "Just now", "5 min ago", "2 hr ago", "3 days ago".
String relativeTime(DateTime? time, DateTime now) {
  if (time == null) return '';
  final seconds = now.difference(time).inSeconds.clamp(0, 1 << 31);
  if (seconds < 60) return 'Just now';
  final minutes = seconds ~/ 60;
  if (minutes < 60) return '$minutes min ago';
  final hours = minutes ~/ 60;
  if (hours < 24) return '$hours hr ago';
  final days = hours ~/ 24;
  return '$days day${days == 1 ? '' : 's'} ago';
}
