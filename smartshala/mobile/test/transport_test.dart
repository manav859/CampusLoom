import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/widgets/app_chips.dart';
import 'package:smartshala_mobile/core/widgets/responsive.dart';
import 'package:smartshala_mobile/features/principal/data/principal_repository.dart';
import 'package:smartshala_mobile/features/principal/data/school_models.dart';
import 'package:smartshala_mobile/features/principal/data/student_models.dart' show ClassChoice;
import 'package:smartshala_mobile/features/principal/data/transport_models.dart';
import 'package:smartshala_mobile/features/principal/transport/assign_students_screen.dart';
import 'package:smartshala_mobile/features/principal/transport/route_detail_screen.dart';
import 'package:smartshala_mobile/features/principal/transport/route_form_screen.dart';
import 'package:smartshala_mobile/features/principal/transport/transport_report_screen.dart';
import 'package:smartshala_mobile/features/principal/transport/transport_screen.dart';
import 'package:smartshala_mobile/features/principal/transport/vehicle_form_screen.dart';

const _bus = {
  'id': 'v1',
  'registrationNumber': 'GJ01AB1234',
  'capacity': 2,
  'driverName': 'Ramesh Patel',
  'driverPhone': '9876543210',
};

const _stops = [
  {'id': 'st1', 'sequence': 1, 'name': 'Shivranjani', 'pickupTime': '07:10', 'dropTime': '14:20'},
  {'id': 'st2', 'sequence': 2, 'name': 'Jodhpur Char Rasta', 'pickupTime': null, 'dropTime': null},
];

/// The shapes GET /transport, /transport/routes/:id and /transport/report return.
final _overviewJson = {
  'summary': {'routes': 2, 'vehicles': 1, 'studentsOnTransport': 3, 'seats': 2},
  'routes': [
    {'id': 'r1', 'name': 'Route 1 - Satellite', 'vehicle': _bus, 'stops': _stops, 'studentCount': 3},
    {'id': 'r2', 'name': 'Route 2', 'vehicle': null, 'stops': <Object>[], 'studentCount': 0},
  ],
  'vehicles': [
    {..._bus, 'routes': [{'id': 'r1', 'name': 'Route 1 - Satellite'}]},
  ],
};

final _routeJson = {
  'id': 'r1',
  'name': 'Route 1 - Satellite',
  'vehicle': _bus,
  'stops': _stops,
  'students': [
    {'id': 's1', 'fullName': 'Asha Rider', 'admissionNumber': 'ADM-1', 'parentPhone': '9000000001', 'transportRequired': true, 'className': '5-A', 'stopId': 'st1'},
    {'id': 's2', 'fullName': 'Bhavin Rider', 'admissionNumber': 'ADM-2', 'parentPhone': '9000000002', 'transportRequired': true, 'className': '5-A', 'stopId': null},
    {'id': 's3', 'fullName': 'Chirag Walker', 'admissionNumber': 'ADM-3', 'parentPhone': '9000000003', 'transportRequired': false, 'className': '6-B', 'stopId': 'st2'},
  ],
};

final _reportJson = {
  'summary': {'routes': 2, 'studentsOnTransport': 3, 'routesOverCapacity': 1, 'routesWithoutVehicle': 1, 'needsRoute': 1, 'notMarked': 1},
  'routes': [
    {
      'id': 'r1',
      'name': 'Route 1 - Satellite',
      'vehicle': _bus,
      'students': 3,
      'capacity': 2,
      'occupancy': 150,
      'overCapacity': true,
      'withoutStop': 1,
      'stops': [
        {..._stops[0], 'students': 1},
        {..._stops[1], 'students': 1},
      ],
    },
    {'id': 'r2', 'name': 'Route 2', 'vehicle': null, 'students': 0, 'capacity': null, 'occupancy': null, 'overCapacity': false, 'withoutStop': 0, 'stops': <Object>[]},
  ],
  'needsRoute': [
    {'id': 's9', 'fullName': 'Diya Waiting', 'admissionNumber': 'ADM-9', 'parentPhone': '9000000009', 'className': '7-A'},
  ],
  'notMarked': [
    {'id': 's3', 'fullName': 'Chirag Walker', 'admissionNumber': 'ADM-3', 'parentPhone': '9000000003', 'className': '6-B', 'routeName': 'Route 1 - Satellite'},
  ],
};

class _FakeRepository extends Fake implements PrincipalRepository {
  final savedRoutes = <(RouteDraft, String?)>[];
  final vehicles = <VehicleDraft>[];
  final assignments = <(List<String>, String, String?)>[];
  final removed = <String>[];

  @override
  Future<TransportOverview> transport() async => TransportOverview.fromJson(_overviewJson);

  @override
  Future<TransportRouteDetail> transportRoute(String id) async => TransportRouteDetail.fromJson(_routeJson);

  @override
  Future<TransportReport> transportReport() async => TransportReport.fromJson(_reportJson);

  @override
  Future<String> saveRoute(RouteDraft draft, {String? id}) async {
    savedRoutes.add((draft, id));
    return id ?? 'new';
  }

  @override
  Future<void> createVehicle(VehicleDraft draft) async => vehicles.add(draft);

  @override
  Future<void> assignToRoute({required List<String> studentIds, required String routeId, String? stopId}) async =>
      assignments.add((studentIds, routeId, stopId));

  @override
  Future<void> removeFromRoute(String studentId) async => removed.add(studentId);

  @override
  Future<List<ClassChoice>> classes() async => [const ClassChoice(id: 'c1', name: '5', section: 'A')];

  @override
  Future<List<ClassStudent>> classStudents(String id) async => [
        ClassStudent.fromJson({'id': 's1', 'fullName': 'Asha Rider', 'admissionNumber': 'ADM-1', 'rollNumber': 1}),
        ClassStudent.fromJson({'id': 's4', 'fullName': 'Esha New', 'admissionNumber': 'ADM-4', 'rollNumber': 2}),
        ClassStudent.fromJson({'id': 's5', 'fullName': 'Farhan New', 'admissionNumber': 'ADM-5', 'rollNumber': 3}),
      ];
}

Future<_FakeRepository> _pump(WidgetTester tester, Widget screen, {double width = 390, double textScale = 1}) async {
  tester.view.physicalSize = Size(width * 2, 6000);
  tester.view.devicePixelRatio = 2.0;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final repo = _FakeRepository();
  await tester.pumpWidget(
    Provider<PrincipalRepository>.value(
      value: repo,
      child: MaterialApp(builder: (context, child) => AppViewport(child: child), home: screen),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  group('Transport models', () {
    test('parse the API shapes', () {
      final overview = TransportOverview.fromJson(_overviewJson);
      expect(overview.routes.first.overCapacity, isTrue);
      expect(overview.routes.first.seatsLabel, '3/2 seats');
      expect(overview.routes.last.seatsLabel, '0 students');
      expect(overview.vehicles.single.routeNames, ['Route 1 - Satellite']);

      final route = TransportRouteDetail.fromJson(_routeJson);
      expect(route.stopName('st2'), 'Jodhpur Char Rasta');
      expect(route.stopName(null), 'No stop');
      expect(route.stops.first.times, 'Pickup 07:10 · Drop 14:20');
      expect(route.stops.last.times, '');
    });

    test('a route draft keeps stop ids so riders stay at their stop', () {
      final draft = RouteDraft(
        name: '  Route 1  ',
        vehicleId: null,
        stops: [StopDraft.from(TransportRouteDetail.fromJson(_routeJson).stops[1]), StopDraft(name: ' Iscon ', pickupTime: '07:30')],
      );
      expect(draft.toJson(), {
        'name': 'Route 1',
        'vehicleId': null,
        'stops': [
          {'id': 'st2', 'name': 'Jodhpur Char Rasta', 'pickupTime': null, 'dropTime': null},
          {'name': 'Iscon', 'pickupTime': '07:30', 'dropTime': null},
        ],
      });
      expect(clockText(7, 5), '07:05');
    });

    test('a vehicle draft sends blanks as null', () {
      expect(const VehicleDraft(registrationNumber: ' gj01 ', capacity: 40, driverName: ' ', driverPhone: '').toJson(), {
        'registrationNumber': 'gj01',
        'capacity': 40,
        'driverName': null,
        'driverPhone': null,
      });
    });

    test('the report CSV has the web columns', () {
      final rows = TransportReport.fromJson(_reportJson).csvRows();
      expect(rows.first, ['Route', 'Vehicle', 'Driver', 'Driver phone', 'Students', 'Seats', 'Occupancy', 'Without a stop']);
      expect(rows[1], ['Route 1 - Satellite', 'GJ01AB1234', 'Ramesh Patel', '9876543210', 3, 2, '150%', 1]);
      expect(rows[2], ['Route 2', '-', '-', '-', 0, '-', '-', 0]);
    });
  });

  group('Transport screens', () {
    testWidgets('overview lists routes and switches to vehicles', (tester) async {
      await _pump(tester, const TransportScreen());
      expect(find.text('Route 1 - Satellite'), findsOneWidget);
      expect(find.text('3/2 seats'), findsOneWidget);
      expect(find.text('Add Route'), findsOneWidget);

      await tester.tap(find.descendant(of: find.byType(SegmentedTabs), matching: find.text('Vehicles')));
      await tester.pumpAndSettle();
      expect(find.text('GJ01AB1234 · 2 seats'), findsOneWidget);
      expect(find.text('Add Vehicle'), findsOneWidget);
    });

    testWidgets('route detail flags a rider not marked for transport and removes one', (tester) async {
      final repo = await _pump(tester, const RouteDetailScreen(routeId: 'r1', vehicles: []));
      expect(find.text('Not marked as needing transport'), findsOneWidget);
      expect(find.text('More students than seats'), findsOneWidget);
      expect(find.text('5-A · No stop'), findsOneWidget);

      await tester.tap(find.byTooltip('Remove from route').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();
      expect(repo.removed, ['s1']);
    });

    testWidgets('add students leaves out riders and sends the chosen stop', (tester) async {
      final repo = await _pump(tester, AssignStudentsScreen(route: TransportRouteDetail.fromJson(_routeJson)));
      await tester.tap(find.text('Class'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('5-A').last);
      await tester.pumpAndSettle();

      expect(find.text('Asha Rider'), findsNothing, reason: 'already on this route');
      await tester.tap(find.text('Select all (2)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add 2 students'));
      await tester.pumpAndSettle();

      final (studentIds, routeId, stopId) = repo.assignments.single;
      expect(studentIds, ['s4', 's5']);
      expect((routeId, stopId), ('r1', 'st1'));
    });

    testWidgets('route form will not save without names', (tester) async {
      final repo = await _pump(tester, const RouteFormScreen(vehicles: []));
      await tester.tap(find.widgetWithText(FilledButton, 'Add Route'));
      await tester.pumpAndSettle();
      expect(find.text('Give the route a name'), findsOneWidget);
      expect(find.text('Name the stop'), findsOneWidget);
      expect(repo.savedRoutes, isEmpty);
    });

    testWidgets('editing a route sends kept stops with their ids in the new order', (tester) async {
      final repo = await _pump(tester, RouteFormScreen(vehicles: const [], existing: TransportRouteDetail.fromJson(_routeJson)));
      await tester.tap(find.byTooltip('Move down').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save Route'));
      await tester.pumpAndSettle();

      final (draft, id) = repo.savedRoutes.single;
      expect(id, 'r1');
      expect([for (final stop in draft.stops) stop.id], ['st2', 'st1']);
    });

    testWidgets('vehicle form checks the driver phone', (tester) async {
      final repo = await _pump(tester, const VehicleFormScreen());
      await tester.enterText(find.widgetWithText(TextFormField, 'Registration number *'), 'GJ01AB1234');
      await tester.enterText(find.widgetWithText(TextFormField, 'Seats *'), '40');
      await tester.enterText(find.widgetWithText(TextFormField, 'Driver phone'), '98765');
      await tester.tap(find.widgetWithText(FilledButton, 'Add Vehicle'));
      await tester.pumpAndSettle();
      expect(find.text('Use a 10-digit phone number'), findsOneWidget);
      expect(repo.vehicles, isEmpty);

      await tester.enterText(find.widgetWithText(TextFormField, 'Driver phone'), '9876543210');
      await tester.tap(find.widgetWithText(FilledButton, 'Add Vehicle'));
      await tester.pumpAndSettle();
      expect(repo.vehicles.single.capacity, 40);
    });

    testWidgets('the report has no fee wording', (tester) async {
      await _pump(tester, const TransportReportScreen());
      expect(find.text('Over capacity'), findsWidgets);
      expect(find.text('Diya Waiting'), findsOneWidget);
      expect(find.text('6-B · ADM-3 · Route 1 - Satellite'), findsOneWidget);

      final texts = tester.widgetList<Text>(find.byType(Text)).map((text) => (text.data ?? '').toLowerCase());
      expect(texts.where((text) => text.contains('fee') || text.contains('₹')), isEmpty);
    });

    for (final (name, screen) in [
      ('Transport', const TransportScreen()),
      ('Route detail', const RouteDetailScreen(routeId: 'r1', vehicles: [])),
      ('Route form', RouteFormScreen(vehicles: const [], existing: TransportRouteDetail.fromJson(_routeJson))),
      ('Vehicle form', const VehicleFormScreen()),
      ('Transport report', const TransportReportScreen()),
    ]) {
      testWidgets('$name lays out at 320dp with 1.3x text', (tester) async {
        await _pump(tester, screen, width: 320, textScale: 1.3);
        expect(tester.takeException(), isNull);
      });
    }
  });
}
