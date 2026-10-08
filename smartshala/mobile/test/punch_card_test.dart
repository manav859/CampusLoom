import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/api/api_exception.dart';
import 'package:smartshala_mobile/core/auth/app_user.dart';
import 'package:smartshala_mobile/core/auth/auth_controller.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/data/messages_repository.dart';
import 'package:smartshala_mobile/features/teacher/data/punch_controller.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_repository.dart';
import 'package:smartshala_mobile/features/teacher/teacher_home_screen.dart';
import 'package:smartshala_mobile/features/teacher/teacher_shell.dart';
import 'package:smartshala_mobile/features/teacher/widgets/swipe_to_punch.dart';

/// A server that keeps today's punch the way the backend does: sessions that a
/// break or a punch-out closes, and a punch-in that opens the next.
class _PunchServer extends Fake implements TeacherRepository {
  _PunchServer(this.state);

  PunchState state;
  final calls = <String>[];

  PunchStatus get _status => PunchStatus(
        state: state,
        punchInAt: DateTime(2026, 10, 8, 9),
        workedMinutes: 90,
        workedSeconds: 90 * 60,
        breakMinutes: state == PunchState.onBreak ? 5 : 0,
        currentSessionStartedAt: state == PunchState.punchedIn ? DateTime.now() : null,
        breakStartedAt: state == PunchState.onBreak ? DateTime.now() : null,
        sessions: [
          PunchSession(startAt: DateTime(2026, 10, 8, 9), endAt: DateTime(2026, 10, 8, 10, 30)),
          if (state == PunchState.punchedIn) PunchSession(startAt: DateTime.now()),
        ],
        punchOutAt: state == PunchState.punchedOut ? DateTime(2026, 10, 8, 10, 30) : null,
      );

  @override
  Future<PunchStatus> punchStatus() async => _status;

  @override
  Future<PunchStatus> punchIn() async {
    calls.add('punchIn');
    state = PunchState.punchedIn;
    return _status;
  }

  @override
  Future<PunchStatus> startBreak() async {
    calls.add('startBreak');
    state = PunchState.onBreak;
    return _status;
  }

  @override
  Future<PunchStatus> punchOut() async {
    calls.add('punchOut');
    state = PunchState.punchedOut;
    return _status;
  }

  // Home's other sections are not under test; failing is fine.
  @override
  Future<TeacherDashboard> dashboard() => Future.error(ApiException(message: 'offline', code: 'NETWORK'));

  @override
  Future<List<SchedulePeriod>> todaySchedule() async => const [];

  /// The other tabs load their own data; offline is enough for them here.
  @override
  dynamic noSuchMethod(Invocation invocation) => Future<Never>.error(ApiException(message: 'offline', code: 'NETWORK'));
}

class _FakeMessages extends Fake implements MessagesRepository {
  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async =>
      const AnnouncementPage(items: [], total: 0, unreadCount: 0, hasMore: false);

  @override
  dynamic noSuchMethod(Invocation invocation) => Future<Never>.error(ApiException(message: 'offline', code: 'NETWORK'));
}

class _FakeAuth extends ChangeNotifier implements AuthController {
  @override
  AppUser? user = const AppUser(id: 'u1', fullName: 'Anita Sharma', role: 'TEACHER', schoolName: 'Noble Public School');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _frames(WidgetTester tester, {int count = 8}) async {
  for (var frame = 0; frame < count; frame++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<_PunchServer> _pump(WidgetTester tester, PunchState state, {Widget home = const TeacherHomeScreen()}) async {
  tester.view.physicalSize = const Size(390 * 2, 2400 * 2);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);

  final server = _PunchServer(state);
  final punch = PunchController(server);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthController>.value(value: _FakeAuth()),
        Provider<TeacherRepository>.value(value: server),
        Provider<MessagesRepository>.value(value: _FakeMessages()),
        ChangeNotifierProvider<PunchController>.value(value: punch),
      ],
      child: MaterialApp(home: home),
    ),
  );
  await punch.load();
  await _frames(tester);
  return server;
}

/// Drags the swipe handle across its whole track.
Future<void> _swipe(WidgetTester tester) async {
  final track = tester.getRect(find.byType(SwipeToPunch));
  await tester.dragFrom(Offset(track.left + 28, track.center.dy), Offset(track.width, 0));
  await _frames(tester);
}

void main() {
  group('PunchStatus.workedAt', () {
    final start = DateTime(2026, 10, 8, 9);
    final closed = PunchSession(startAt: start, endAt: start.add(const Duration(hours: 2)));

    test('runs while punched in', () {
      final now = DateTime(2026, 10, 8, 12);
      final status = PunchStatus(
        state: PunchState.punchedIn,
        currentSessionStartedAt: DateTime(2026, 10, 8, 11, 30),
        sessions: [closed, PunchSession(startAt: DateTime(2026, 10, 8, 11, 30))],
      );
      expect(status.workedAt(now), const Duration(hours: 2, minutes: 30));
    });

    test('holds still on a break and after punching out', () {
      final later = DateTime(2026, 10, 8, 18);
      expect(PunchStatus(state: PunchState.onBreak, sessions: [closed]).workedAt(later), const Duration(hours: 2));
      expect(PunchStatus(state: PunchState.punchedOut, sessions: [closed]).workedAt(later), const Duration(hours: 2));
    });

    test('follows the server clock, not a phone set a few minutes out', () {
      final status = PunchStatus(
        state: PunchState.punchedIn,
        currentSessionStartedAt: DateTime(2026, 10, 8, 11),
        sessions: [PunchSession(startAt: DateTime(2026, 10, 8, 11))],
        clockOffset: const Duration(minutes: 5),
      );
      // The phone reads 11:55; the server is at 12:00.
      expect(status.workedAt(DateTime(2026, 10, 8, 11, 55)), const Duration(hours: 1));
    });

    test('reads ON_BREAK and the timer fields from the server', () {
      final status = PunchStatus.fromJson({
        'state': 'ON_BREAK',
        'punchInAt': '2026-10-08T03:30:00.000Z',
        'workedMinutes': 120,
        'workedSeconds': 7200,
        'breakMinutes': 10,
        'breakStartedAt': '2026-10-08T05:30:00.000Z',
        'currentSessionStartedAt': null,
        'sessions': [
          {'startAt': '2026-10-08T03:30:00.000Z', 'endAt': '2026-10-08T05:30:00.000Z'},
        ],
        'serverTime': DateTime.now().toUtc().toIso8601String(),
      });
      expect(status.state, PunchState.onBreak);
      expect(status.sessions, hasLength(1));
      expect(status.workedAt(DateTime.now()), const Duration(hours: 2));
    });
  });

  testWidgets('punched in: the timer ticks, and a break is one tap away', (tester) async {
    final server = await _pump(tester, PunchState.punchedIn);
    expect(find.text('Working'), findsOneWidget);
    expect(find.text('Swipe To Punch Out'), findsOneWidget);

    String timer() => tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data ?? '')
        .firstWhere((text) => RegExp(r'^\d\d:\d\d:\d\d$').hasMatch(text));
    final before = timer();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 1100)));
    await tester.pump(const Duration(seconds: 1));
    expect(timer(), isNot(before), reason: 'the timer counts while working');

    await tester.tap(find.text('Take a Break'));
    await _frames(tester);
    expect(server.calls, ['startBreak']);
    expect(find.text('On a break'), findsOneWidget);
    expect(find.textContaining('timer paused'), findsOneWidget);

    final paused = timer();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 1100)));
    await tester.pump(const Duration(seconds: 1));
    expect(timer(), paused, reason: 'the timer stops on a break');
  });

  testWidgets('on a break: swiping ends it; punching out from it asks first', (tester) async {
    final server = await _pump(tester, PunchState.onBreak);
    expect(find.text('Swipe To End Break'), findsOneWidget);

    await tester.tap(find.text('Punch out for the day'));
    await _frames(tester);
    expect(find.text('Punch out for the day?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await _frames(tester);
    expect(server.calls, isEmpty, reason: 'cancelling does nothing');

    await _swipe(tester);
    expect(server.calls, ['punchIn']);
    expect(find.text('Working'), findsOneWidget);
  });

  testWidgets('punched out by mistake: the day can be punched into again', (tester) async {
    final server = await _pump(tester, PunchState.punchedOut);
    expect(find.text('Punched out'), findsWidgets);
    expect(find.text('Swipe To Punch In Again'), findsOneWidget);

    await _swipe(tester);
    expect(server.calls, ['punchIn']);
    expect(find.text('Working'), findsOneWidget);
  });

  testWidgets('the swipe lives on Home only, and the tab is called Pay Slip', (tester) async {
    await _pump(tester, PunchState.notPunchedIn, home: const TeacherShell());
    expect(find.byType(SwipeToPunch), findsOneWidget, reason: 'Home');
    expect(find.text('Pay Slip'), findsOneWidget);
    expect(find.text('Salary'), findsNothing);

    for (final tab in ['Calendar', 'Students', 'Pay Slip', 'Messages']) {
      await tester.tap(find.text(tab).last);
      await _frames(tester);
      expect(
        find.byType(SwipeToPunch).hitTestable(),
        findsNothing,
        reason: 'no punch control on $tab',
      );
    }
  });
}
