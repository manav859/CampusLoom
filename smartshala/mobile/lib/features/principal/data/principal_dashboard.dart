import '../../../core/data/dashboard_models.dart';

/// GET /dashboard for a Principal or Admin, with the numbers the principal
/// app's Home derives from it.
class PrincipalDashboard {
  const PrincipalDashboard({
    required this.totalStudents,
    required this.totalClasses,
    required this.classesMarked,
    required this.attendancePercentage,
    required this.alertCount,
    required this.totalCollected,
    required this.totalPending,
    required this.defaulterCount,
    required this.attendance,
    required this.alerts,
    required this.defaulters,
  });

  final int totalStudents;
  final int totalClasses;
  final int classesMarked;

  /// Present / marked across the classes marked so far today, rounded.
  final int attendancePercentage;

  /// Low attendance + repeat absentees + high-severity risks, counted server-side.
  final int alertCount;
  final double totalCollected;
  final double totalPending;
  final int defaulterCount;
  final List<ClassAttendance> attendance;
  final List<DashboardAlert> alerts;
  final List<FeeDefaulter> defaulters;

  static const empty = PrincipalDashboard(
    totalStudents: 0,
    totalClasses: 0,
    classesMarked: 0,
    attendancePercentage: 0,
    alertCount: 0,
    totalCollected: 0,
    totalPending: 0,
    defaulterCount: 0,
    attendance: [],
    alerts: [],
    defaulters: [],
  );

  /// The web's pulse line, word for word.
  String get pulse =>
      '$classesMarked of $totalClasses classes marked today, $defaulterCount fee follow-ups pending.';

  int get studentsPresent =>
      attendance.fold(0, (sum, item) => sum + (item.marked ? item.present : 0));

  int get classesPending =>
      totalClasses > classesMarked ? totalClasses - classesMarked : 0;

  /// Every pending item, most important first: leave only the principal can
  /// approve, then today's unmarked classes, flagged students and fee
  /// defaulters. Kinds with nothing pending are left out.
  List<AttentionItem> attentionItems({required int pendingLeave}) => [
    if (pendingLeave > 0) (kind: AttentionKind.leave, count: pendingLeave),
    if (classesPending > 0)
      (kind: AttentionKind.attendance, count: classesPending),
    if (alertCount > 0) (kind: AttentionKind.students, count: alertCount),
    if (defaulterCount > 0) (kind: AttentionKind.fees, count: defaulterCount),
  ];

  /// The Pending Actions card: what [attentionItems] counts, less fee
  /// defaulters — a school can have hundreds, which would drown the rest, and
  /// Fee Overview already covers fees.
  int pendingActions({required int pendingLeave}) =>
      attentionItems(pendingLeave: pendingLeave)
          .where((item) => item.kind != AttentionKind.fees)
          .fold(0, (sum, item) => sum + item.count);

  /// "—" until a class is marked: 0% would read as everyone absent.
  String get attendanceLabel =>
      classesMarked == 0 ? '—' : '$attendancePercentage%';

  factory PrincipalDashboard.fromJson(Map<String, dynamic> json) {
    final kpis = (json['kpis'] as Map?)?.cast<String, dynamic>() ?? const {};
    final fees = (json['feeSummary'] as Map?)?.cast<String, dynamic>();
    int kpi(String key) => (kpis[key] as num?)?.toInt() ?? 0;
    double money(Object? value) =>
        value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

    final alerts = DashboardAlert.listFrom(json['alerts']);
    final defaulters = FeeDefaulter.listFrom(json['defaulters']);

    return PrincipalDashboard(
      totalStudents: kpi('totalStudents'),
      totalClasses: kpi('totalClasses'),
      classesMarked: kpi('classesMarked'),
      attendancePercentage: kpi('todayAttendancePercentage'),
      // Same fallbacks, in the same order, as the web.
      alertCount: (kpis['alerts'] as num?)?.toInt() ?? alerts.length,
      defaulterCount:
          (fees?['defaulterCount'] as num?)?.toInt() ?? defaulters.length,
      totalCollected: money(fees?['totalCollected']),
      totalPending: money(fees?['totalPending']),
      attendance: ClassAttendance.listFrom(json['attendance']),
      alerts: alerts,
      defaulters: defaulters,
    );
  }
}

enum AttentionKind { leave, attendance, students, fees }

typedef AttentionItem = ({AttentionKind kind, int count});

/// One GET /activity-logs item as a Today's Activity line, or null when it is
/// not one of the events Home shows: attendance submitted, a payment
/// recorded, a leave request or an announcement.
ActivityEntry? keyActivity(Map<String, dynamic> json) {
  final entityType = json['entityType'] as String? ?? '';
  final action = json['action'] as String? ?? '';
  final summary = json['summary'] as String? ?? '';
  // Leave and announcements are logged by route ("Name POST /api/v1/leave/requests");
  // the end anchor skips decisions, cancels and read receipts.
  bool posted(String path) =>
      action == 'CREATE_OR_RUN' && RegExp('$path' r'(?:\?|$)').hasMatch(summary);

  final entry = ActivityEntry.fromJson(json);
  ActivityEntry retitled(String text) => ActivityEntry(
    id: entry.id,
    text: text,
    createdAt: entry.createdAt,
    type: entry.type,
    actorName: entry.actorName,
  );

  if (entityType == 'ATTENDANCE' && action == 'CREATE') return entry;
  if (entityType == 'FEE' && action == 'CREATE') return entry;
  if (entityType == 'LEAVE' && posted('/leave/requests')) {
    return retitled('Leave request submitted');
  }
  if (entityType == 'ANNOUNCEMENTS' && posted('/announcements')) {
    final body = ((json['afterJson'] as Map?)?['body'] as Map?) ?? const {};
    final title = (body['title'] as String?)?.trim() ?? '';
    return retitled(title.isEmpty ? 'Announcement sent' : 'Announcement sent: $title');
  }
  return null;
}
