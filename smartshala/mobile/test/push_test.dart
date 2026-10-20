import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/api/api_client.dart';
import 'package:smartshala_mobile/core/auth/token_storage.dart';
import 'package:smartshala_mobile/core/config/app_config.dart';
import 'package:smartshala_mobile/core/push/push_message.dart';
import 'package:smartshala_mobile/core/push/push_messaging.dart';
import 'package:smartshala_mobile/core/push/push_service.dart';

/// The lifecycle of a push registration: who the device is registered to, what
/// happens when it is not configured, and where a tapped notification sends the
/// app. Firebase itself never runs here — [PushMessaging] stands in for it.

class _Storage extends Fake implements TokenStorage {
  @override
  Future<String?> readAccessToken() async => 'access-token';
}

/// Records every call the service makes, and can refuse them.
class _Server implements HttpClientAdapter {
  _Server({this.fail = false});

  final bool fail;
  final List<({String method, String path, Object? body})> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add((method: options.method, path: options.uri.path, body: options.data));
    if (fail) {
      return ResponseBody.fromString(
        jsonEncode({
          'error': {'code': 'SERVER_ERROR', 'message': 'nope'},
        }),
        500,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString(
      jsonEncode({'registered': true}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FakeMessaging implements PushMessaging {
  _FakeMessaging({this.configured = true, this.permitted = true});

  final bool configured;
  final bool permitted;

  final registered = StreamController<String>.broadcast();
  final foreground = StreamController<PushMessage>.broadcast();
  final opened = StreamController<PushMessage>.broadcast();

  PushMessage? launchMessage;
  int registerCalls = 0;
  int unregisterCalls = 0;

  @override
  Future<bool> initialize(AppFlavor flavor) async => configured;

  @override
  Future<bool> requestPermission() async => permitted;

  @override
  Future<void> register() async => registerCalls++;

  @override
  Stream<String> get onRegistered => registered.stream;

  @override
  Stream<PushMessage> get onMessage => foreground.stream;

  @override
  Stream<PushMessage> get onMessageOpened => opened.stream;

  @override
  Future<PushMessage?> initialMessage() async => launchMessage;

  @override
  Future<void> unregister() async => unregisterCalls++;

  void dispose() {
    registered.close();
    foreground.close();
    opened.close();
  }
}

PushService _service(
  _FakeMessaging messaging,
  _Server server, {
  bool showsInAppBanner = true,
}) =>
    PushService(
      api: ApiClient(
        config: AppConfig.forFlavor(AppFlavor.teacher),
        storage: _Storage(),
        httpClientAdapter: server,
      )..useSchoolCode('SS000001'),
      config: AppConfig.forFlavor(AppFlavor.teacher),
      messaging: messaging,
      showsInAppBanner: showsInAppBanner,
    );

void main() {
  group('push target', () {
    test('maps every name the server sends', () {
      expect(PushTarget.parse('home'), PushTarget.home);
      expect(PushTarget.parse('messages'), PushTarget.messages);
      expect(PushTarget.parse('calendar'), PushTarget.calendar);
      expect(PushTarget.parse('leave_approval'), PushTarget.leaveApproval);
    });

    test('a target this version does not know is not a crash', () {
      // A newer backend may send a screen this build has never heard of. The
      // notification still opens the app; it just does not jump anywhere.
      expect(PushTarget.parse('timetable'), isNull);
      expect(PushTarget.parse(null), isNull);
      expect(const PushMessage(title: 'Hi').target, isNull);
    });
  });

  group('banner text', () {
    test('joins the two lines the notification carries', () {
      expect(
        const PushMessage(title: 'Leave approved', body: '21 Oct').bannerText,
        'Leave approved — 21 Oct',
      );
    });

    test('does not leave a dangling dash when one line is missing', () {
      expect(const PushMessage(title: 'Leave approved').bannerText, 'Leave approved');
      expect(const PushMessage(body: '21 Oct').bannerText, '21 Oct');
    });
  });

  group('registration', () {
    test('hands the installation id to the server once Firebase reports it', () async {
      final messaging = _FakeMessaging();
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      expect(messaging.registerCalls, 1);
      // Nothing is registered until the platform answers.
      expect(server.calls, isEmpty);
      expect(service.isActive, isFalse);

      messaging.registered.add('fid-1');
      await pumpEventQueue();

      expect(server.calls.single.method, 'POST');
      expect(server.calls.single.path, endsWith('/push/devices'));
      expect(server.calls.single.body, {'fid': 'fid-1', 'platform': 'ANDROID'});
      expect(service.isActive, isTrue);

      messaging.dispose();
    });

    test('a replaced installation id is registered too', () async {
      final messaging = _FakeMessaging();
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      messaging.registered.add('fid-1');
      await pumpEventQueue();
      // The platform can rotate the id at any time; the old one stops working.
      messaging.registered.add('fid-2');
      await pumpEventQueue();

      expect(server.calls.length, 2);
      expect(server.calls.last.body, {'fid': 'fid-2', 'platform': 'ANDROID'});

      messaging.dispose();
    });

    test('does nothing at all while Firebase is not configured', () async {
      // The state both apps ship in: no project in push_config.dart. No
      // permission prompt, no call, no error.
      final messaging = _FakeMessaging(configured: false);
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      messaging.registered.add('fid-1');
      await pumpEventQueue();

      expect(messaging.registerCalls, 0);
      expect(server.calls, isEmpty);
      expect(service.isActive, isFalse);

      messaging.dispose();
    });

    test('a refused permission stops short of registering', () async {
      final messaging = _FakeMessaging(permitted: false);
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      expect(messaging.registerCalls, 0);
      expect(server.calls, isEmpty);

      messaging.dispose();
    });

    test('a server that refuses the registration is not fatal', () async {
      final messaging = _FakeMessaging();
      final server = _Server(fail: true);
      final service = _service(messaging, server);

      await service.start();
      messaging.registered.add('fid-1');
      await pumpEventQueue();

      // The call was made and failed; the app carries on without push rather
      // than surfacing anything to the user.
      expect(server.calls.length, 1);
      expect(service.isActive, isFalse);

      messaging.dispose();
    });

    test('starting twice registers once', () async {
      final messaging = _FakeMessaging();
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      await service.start();

      expect(messaging.registerCalls, 1);
      messaging.dispose();
    });
  });

  group('sign-out', () {
    test('drops the device on the server and on the platform', () async {
      final messaging = _FakeMessaging();
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      messaging.registered.add('fid-1');
      await pumpEventQueue();

      await service.stop();

      expect(server.calls.last.method, 'DELETE');
      expect(server.calls.last.path, endsWith('/push/devices'));
      expect(server.calls.last.body, {'fid': 'fid-1'});
      expect(messaging.unregisterCalls, 1);
      expect(service.isActive, isFalse);

      messaging.dispose();
    });

    test('a sign-out before anything was registered calls nothing', () async {
      final messaging = _FakeMessaging(configured: false);
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      await service.stop();

      expect(server.calls, isEmpty);
      expect(messaging.unregisterCalls, 0);

      messaging.dispose();
    });

    test('a stopped service can be started again by the next sign-in', () async {
      final messaging = _FakeMessaging();
      final server = _Server();
      final service = _service(messaging, server);

      await service.start();
      await service.stop();
      await service.start();

      expect(messaging.registerCalls, 2);
      messaging.dispose();
    });
  });

  group('an arriving notification', () {
    test('tapped from the background, publishes its target once', () async {
      final messaging = _FakeMessaging();
      final service = _service(messaging, _Server());
      await service.start();

      messaging.opened.add(const PushMessage(data: {'target': 'leave_approval'}));
      await pumpEventQueue();

      expect(service.takePendingTarget(), PushTarget.leaveApproval);
      // Read once: a shell rebuilding must not navigate a second time.
      expect(service.takePendingTarget(), isNull);

      messaging.dispose();
    });

    test('tapped from cold, the launch notification is picked up', () async {
      final messaging = _FakeMessaging()
        ..launchMessage = const PushMessage(data: {'target': 'calendar'});
      final service = _service(messaging, _Server());

      await service.start();

      expect(service.takePendingTarget(), PushTarget.calendar);
      messaging.dispose();
    });

    test('in the foreground on Android, becomes an in-app banner', () async {
      final messaging = _FakeMessaging();
      final service = _service(messaging, _Server());
      await service.start();

      messaging.foreground.add(const PushMessage(title: 'Holiday: Diwali', body: '8 Nov'));
      await pumpEventQueue();

      expect(service.takePendingBanner()?.bannerText, 'Holiday: Diwali — 8 Nov');
      expect(service.takePendingBanner(), isNull);

      messaging.dispose();
    });

    test('in the foreground on iOS, draws nothing in-app', () async {
      // iOS shows its own banner over the app; a second one would be a double.
      final messaging = _FakeMessaging();
      final service = _service(messaging, _Server(), showsInAppBanner: false);
      await service.start();

      messaging.foreground.add(const PushMessage(title: 'Holiday: Diwali'));
      await pumpEventQueue();

      expect(service.takePendingBanner(), isNull);
      messaging.dispose();
    });
  });
}
