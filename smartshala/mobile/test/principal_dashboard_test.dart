import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/auth/app_user.dart';
import 'package:smartshala_mobile/core/auth/auth_controller.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/core/data/dashboard_models.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/data/messages_repository.dart';
import 'package:smartshala_mobile/core/widgets/app_cards.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_dashboard.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/principal_home_screen.dart';
import 'package:smartshala_mobile/features/principal/principal_shell.dart';

/// The web and the app put a non-breaking space after the rupee sign.
String rupees(String amount) => '₹${String.fromCharCode(0xa0)}$amount';

/// A GET /dashboard body for a principal, shaped as the backend returns it
/// (fee figures included as Decimal strings, the way Prisma serialises them).
const _dashboardJson = {
  'role': 'PRINCIPAL',
  'kpis': {
    'totalStudents': 412,
    'totalClasses': 12,
    'classesMarked': 9,
    'classesPending': 3,
    'todayAttendancePercentage': 82,
    'alerts': 5,
  },
  'attendance': [
    {'className': '6-A', 'totalStudents': 32, 'marked': true, 'present': 30, 'absent': 2, 'attendancePercentage': 94},
    {'className': '7-B', 'totalStudents': 34, 'marked': true, 'present': 24, 'absent': 10, 'attendancePercentage': 71},
    {'className': '8-C', 'totalStudents': 30, 'marked': false, 'present': 0, 'absent': 0, 'attendancePercentage': 0},
  ],
  'feeSummary': {'totalCollected': '1250000.00', 'totalPending': 380000, 'defaulterCount': 14},
  'defaulters': [
    {'studentId': 's1', 'name': 'Riya Patel', 'class': '9-A', 'balance': 12500, 'daysOverdue': 45},
    {'studentId': 's2', 'name': 'Kabir Shah', 'class': '6-B', 'balance': 4000, 'daysOverdue': 5},
    {'studentId': 's3', 'name': 'Third Defaulter', 'class': '5-A', 'balance': 100, 'daysOverdue': 0},
  ],
  'alerts': [
    {
      'type': 'BEHAVIOUR_INCIDENT',
      'studentId': 's4',
      'studentName': 'Arjun Mehta',
      'message': 'Fight in corridor',
      'severity': 'HIGH',
      'flags': ['8-C', 'Action: Parent called', 'Logged by Anita Sharma'],
    },
  ],
};

const _activityJson = [
  {
    'id': 'a1',
    'entityType': 'STUDENTS',
    'action': 'CREATE',
    'summary': 'POST /api/v1/students',
    'afterJson': {'body': {'fullName': 'Meera Iyer'}},
    'actor': {'fullName': 'Payroll Demo Principal'},
  },
  {
    'id': 'a2',
    'entityType': 'ATTENDANCE',
    'action': 'CREATE',
    'summary': 'Marked attendance for 6-A',
    'actor': {'fullName': 'Anita Sharma'},
  },
  {
    'id': 'a3',
    'entityType': 'FEE',
    'action': 'CREATE',
    'summary': 'Recorded fee for Riya Patel for ₹5,000',
    'actor': {'fullName': 'Office Clerk'},
  },
  {
    'id': 'a4',
    'entityType': 'LEAVE',
    'action': 'CREATE_OR_RUN',
    'summary': 'Anita Sharma POST /api/v1/leave/requests',
    'actor': {'fullName': 'Anita Sharma'},
  },
  {
    'id': 'a5',
    'entityType': 'LEAVE',
    'action': 'UPDATE',
    'summary': 'Payroll Demo Principal PATCH /api/v1/leave/requests/abc/decision',
    'actor': {'fullName': 'Payroll Demo Principal'},
  },
  {
    'id': 'a6',
    'entityType': 'ANNOUNCEMENTS',
    'action': 'CREATE_OR_RUN',
    'summary': 'Payroll Demo Principal POST /SS000001/api/v1/announcements',
    'afterJson': {'body': {'title': 'Sports Day on Friday'}},
    'actor': {'fullName': 'Payroll Demo Principal'},
  },
  {
    'id': 'a7',
    'entityType': 'ANNOUNCEMENTS',
    'action': 'CREATE_OR_RUN',
    'summary': 'Anita Sharma POST /api/v1/announcements/abc/read',
    'actor': {'fullName': 'Anita Sharma'},
  },
  {
    'id': 'a8',
    'entityType': 'ATTENDANCE',
    'action': 'UPDATE',
    'summary': 'Updated attendance for 6-A',
    'actor': {'fullName': 'Anita Sharma'},
  },
];

class _FakeRepository extends Fake implements PrincipalRepository {
  @override
  Future<PrincipalDashboard> dashboard() async => PrincipalDashboard.fromJson(_dashboardJson);

  /// The real filter, over the raw log.
  @override
  Future<List<ActivityEntry>> activity(DateTime day) async => [
        for (final item in _activityJson)
          keyActivity({...item, 'createdAt': DateTime.now().toUtc().toIso8601String()}),
      ].whereType<ActivityEntry>().toList();

  @override
  Future<List<CalendarEvent>> calendarMonth(DateTime month) async => const [];
}

class _FakeMessages extends Fake implements MessagesRepository {
  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async =>
      const AnnouncementPage(items: [], total: 0, unreadCount: 0, hasMore: false);

  @override
  Future<LeavePage> schoolLeave({LeaveStatus? status, String? search, int limit = 20, int offset = 0}) async =>
      const LeavePage(items: [], total: 3, hasMore: false, summary: LeaveSummary(total: 7, pending: 3));
}

class _FakeAuth extends ChangeNotifier implements AuthController {
  @override
  AppUser? user = const AppUser(id: 'p1', fullName: 'Payroll Demo Principal', role: 'PRINCIPAL', schoolName: 'Noble Public School');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _pumpHome(
  WidgetTester tester, {
  required double width,
  double textScale = 1.0,
  Widget home = const PrincipalHomeScreen(),
}) async {
  tester.view.physicalSize = Size(width * 2, 9000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthController>.value(value: _FakeAuth()),
        Provider<PrincipalRepository>.value(value: _FakeRepository()),
        Provider<MessagesRepository>.value(value: _FakeMessages()),
      ],
      child: MaterialApp(
        builder: (context, child) => AppViewport(child: child),
        home: home,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('formatInr matches the web formatINR', () {
    test('compacts lakhs and crores and trims trailing zeroes', () {
      expect(formatInr(1250000), rupees('12.5 Lakh'));
      expect(formatInr(100000), rupees('1 Lakh'));
      expect(formatInr(25000000), rupees('2.5 Crore'));
      expect(formatInr(99999), rupees('99,999'));
    });

    test('groups Indian-style when not compact', () {
      expect(formatInr(1250000, compact: false), rupees('12,50,000'));
      expect(formatInr(32700.5, compact: false, fractionDigits: 2), rupees('32,700.50'));
    });
  });

  group('PrincipalDashboard.fromJson', () {
    final dashboard = PrincipalDashboard.fromJson(_dashboardJson);

    test('derives the web pulse line and today\'s attendance', () {
      // DashboardHome.tsx: `${markedClasses} of ${totalClasses} classes marked today, ${defaulterCount} fee follow-ups pending.`
      expect(dashboard.pulse, '9 of 12 classes marked today, 14 fee follow-ups pending.');
      expect(dashboard.attendancePercentage, 82);
      expect(dashboard.studentsPresent, 54, reason: 'present in marked classes only');
      expect(dashboard.classesPending, 3);
    });

    test('reads fee figures sent as Decimal strings', () {
      expect(dashboard.totalCollected, 1250000);
      expect(dashboard.totalPending, 380000);
    });

    test('ranks pending items leave, attendance, students, fees; the total leaves out fees', () {
      expect(dashboard.attentionItems(pendingLeave: 3), [
        (kind: AttentionKind.leave, count: 3),
        (kind: AttentionKind.attendance, count: 3),
        (kind: AttentionKind.students, count: 5),
        (kind: AttentionKind.fees, count: 14),
      ]);
      expect(dashboard.pendingActions(pendingLeave: 3), 11, reason: '3 leave + 3 unmarked + 5 flagged');
    });

    test('leaves out kinds with nothing pending', () {
      final quiet = PrincipalDashboard.fromJson({
        ..._dashboardJson,
        'kpis': {'totalClasses': 12, 'classesMarked': 12, 'alerts': 0},
        'feeSummary': {'defaulterCount': 2},
      });
      expect(quiet.attentionItems(pendingLeave: 0), [(kind: AttentionKind.fees, count: 2)]);
      expect(quiet.pendingActions(pendingLeave: 0), 0, reason: 'defaulters are listed, not counted');
    });

    test('shows attendance as a dash until a class is marked', () {
      expect(dashboard.attendanceLabel, '82%');
      final early = PrincipalDashboard.fromJson({
        ..._dashboardJson,
        'kpis': {'totalClasses': 12, 'classesMarked': 0, 'todayAttendancePercentage': 0},
      });
      expect(early.attendanceLabel, '—');
    });

    test('falls back to the defaulter list when the fee summary is missing', () {
      final bare = PrincipalDashboard.fromJson({..._dashboardJson, 'feeSummary': null});
      expect(bare.defaulterCount, 3);
    });
  });

  test('activity lines read like the web feed', () {
    final entries = _activityJson.map(ActivityEntry.fromJson).toList();
    expect(entries[0].text, 'Create student Meera Iyer', reason: 'route summaries are rewritten');
    expect(entries[1].text, 'Marked attendance for 6-A', reason: 'plain summaries pass through');
    expect(entries[1].type, ActivityType.attendance);

    final now = DateTime(2026, 9, 13, 12);
    expect(relativeTime(now.subtract(const Duration(seconds: 20)), now), 'Just now');
    expect(relativeTime(now.subtract(const Duration(minutes: 5)), now), '5 min ago');
    expect(relativeTime(now.subtract(const Duration(days: 1, hours: 2)), now), '1 day ago');
  });

  test("Today's Activity keeps attendance, payments, leave requests and announcements", () {
    final kept = _activityJson.map(keyActivity).whereType<ActivityEntry>().toList();
    expect(kept.map((entry) => entry.id), ['a2', 'a3', 'a4', 'a6'],
        reason: 'no student edits, leave decisions, read receipts or attendance corrections');
    expect(kept.map((entry) => entry.text), [
      'Marked attendance for 6-A',
      'Recorded fee for Riya Patel for ₹5,000',
      'Leave request submitted',
      'Announcement sent: Sports Day on Friday',
    ]);
    expect(kept[1].type, ActivityType.fee);
  });

  testWidgets('home shows the overview, attention items and key activity', (tester) async {
    await _pumpHome(tester, width: 390);

    expect(find.text('Noble Public School'), findsOneWidget);
    for (final label in ['Students', 'Attendance', 'Fee Collected', 'Pending Actions']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
    expect(find.text('412'), findsOneWidget);
    expect(find.text('82%'), findsNWidgets(2), reason: 'overview card and Attendance Today');
    expect(find.text('11'), findsOneWidget, reason: '3 leave + 3 unmarked + 5 flagged, not the 14 defaulters');
    expect(find.text(rupees('12.5 Lakh')), findsNWidgets(2), reason: 'overview card and fee overview');

    for (final action in ['Teachers', 'Fees', 'Leave Requests', 'Send Notice']) {
      expect(find.text(action), findsOneWidget, reason: action);
    }
    expect(find.text('3'), findsOneWidget, reason: 'pending leave badge on Leave Requests');

    expect(find.text('9/12'), findsOneWidget);
    expect(find.text('54'), findsOneWidget, reason: 'students present');
    expect(find.text('Class 7-B'), findsNothing, reason: 'no per-class list any more');

    expect(find.text('3 leave requests'), findsOneWidget);
    expect(find.text('3 classes'), findsOneWidget);
    expect(find.text('5 students flagged'), findsOneWidget);
    expect(find.text('14 fee defaulters'), findsNothing, reason: 'only the top three');

    expect(find.text('Leave request submitted'), findsOneWidget);
    expect(find.text('Create student Meera Iyer'), findsNothing);
  });

  // A layout overflow fails a widget test, so reaching the end proves it fits.
  testWidgets('home fits a small phone with large text', (tester) async {
    await _pumpHome(tester, width: 320, textScale: 1.3);
    expect(find.text('Pending Actions'), findsOneWidget);
  });

  testWidgets('home puts all four overview cards on one row on a tablet', (tester) async {
    await _pumpHome(tester, width: 1200);
    final tops = tester.widgetList<KpiCard>(find.byType(KpiCard)).map((card) => tester.getRect(find.byWidget(card)).top).toSet();
    expect(find.byType(KpiCard), findsNWidgets(4));
    expect(tops, hasLength(1), reason: 'every card starts on the same row');
  });

  testWidgets('bottom bar is Home, Messages, Calendar and More, with + in the middle', (tester) async {
    await _pumpHome(tester, width: 390, home: const PrincipalShell());

    final bar = find.byType(BottomAppBar);
    final labels = tester
        .widgetList<Text>(find.descendant(of: bar, matching: find.byType(Text)))
        .map((text) => text.data)
        .toList();
    expect(labels, ['Home', 'Messages', 'Calendar', 'More']);
    expect(
      tester.getCenter(find.byType(FloatingActionButton)).dx,
      closeTo(tester.getCenter(bar).dx, 1),
      reason: 'the + stays centred in the notch',
    );

    await tester.tap(find.descendant(of: bar, matching: find.text('Calendar')));
    await tester.pumpAndSettle();
    expect(find.text('Academic Calendar'), findsOneWidget);

    await tester.tap(find.descendant(of: bar, matching: find.text('More')));
    await tester.pumpAndSettle();
    expect(find.text('Reports'), findsOneWidget);
    expect(find.text('Analytics'), findsOneWidget);
  });
}
