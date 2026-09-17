// Transport for the principal app, read from the same /transport endpoints as
// the web Transport page and Transport Report.

int _int(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

String? _text(Object? value) {
  final text = value is String ? value.trim() : null;
  return text == null || text.isEmpty ? null : text;
}

List<Map<String, dynamic>> _maps(Object? value) =>
    ((value as List?) ?? const []).map((item) => (item as Map).cast<String, dynamic>()).toList();

class TransportVehicle {
  const TransportVehicle({
    required this.id,
    required this.registrationNumber,
    required this.capacity,
    this.driverName,
    this.driverPhone,
    this.routeNames = const [],
  });

  final String id;
  final String registrationNumber;
  final int capacity;
  final String? driverName;
  final String? driverPhone;

  /// Only on the overview's vehicle list.
  final List<String> routeNames;

  String get label => driverName == null ? registrationNumber : '$registrationNumber · $driverName';

  factory TransportVehicle.fromJson(Map<String, dynamic> json) => TransportVehicle(
        id: json['id'] as String,
        registrationNumber: '${json['registrationNumber'] ?? ''}',
        capacity: _int(json['capacity']),
        driverName: _text(json['driverName']),
        driverPhone: _text(json['driverPhone']),
        routeNames: [for (final route in _maps(json['routes'])) '${route['name'] ?? ''}'],
      );

  static TransportVehicle? maybe(Object? json) =>
      json is Map ? TransportVehicle.fromJson(json.cast<String, dynamic>()) : null;
}

class TransportStop {
  const TransportStop({
    required this.id,
    required this.sequence,
    required this.name,
    this.pickupTime,
    this.dropTime,
    this.students,
  });

  final String id;
  final int sequence;
  final String name;
  final String? pickupTime;
  final String? dropTime;

  /// Only in the report.
  final int? students;

  String get times => [
        if (pickupTime != null) 'Pickup $pickupTime',
        if (dropTime != null) 'Drop $dropTime',
      ].join(' · ');

  factory TransportStop.fromJson(Map<String, dynamic> json) => TransportStop(
        id: json['id'] as String,
        sequence: _int(json['sequence']),
        name: '${json['name'] ?? ''}',
        pickupTime: _text(json['pickupTime']),
        dropTime: _text(json['dropTime']),
        students: json['students'] is num ? _int(json['students']) : null,
      );
}

/// A route row on the overview.
class TransportRouteSummary {
  const TransportRouteSummary({
    required this.id,
    required this.name,
    required this.stops,
    required this.studentCount,
    this.vehicle,
  });

  final String id;
  final String name;
  final TransportVehicle? vehicle;
  final List<TransportStop> stops;
  final int studentCount;

  bool get overCapacity => vehicle != null && studentCount > vehicle!.capacity;

  String get seatsLabel => vehicle == null ? '$studentCount students' : '$studentCount/${vehicle!.capacity} seats';

  factory TransportRouteSummary.fromJson(Map<String, dynamic> json) => TransportRouteSummary(
        id: json['id'] as String,
        name: '${json['name'] ?? ''}',
        vehicle: TransportVehicle.maybe(json['vehicle']),
        stops: _maps(json['stops']).map(TransportStop.fromJson).toList(),
        studentCount: _int(json['studentCount']),
      );
}

/// GET /transport.
class TransportOverview {
  const TransportOverview({
    required this.routes,
    required this.vehicles,
    required this.studentsOnTransport,
    required this.seats,
  });

  final List<TransportRouteSummary> routes;
  final List<TransportVehicle> vehicles;
  final int studentsOnTransport;
  final int seats;

  factory TransportOverview.fromJson(Map<String, dynamic> json) {
    final summary = (json['summary'] as Map?)?.cast<String, dynamic>() ?? const {};
    return TransportOverview(
      routes: _maps(json['routes']).map(TransportRouteSummary.fromJson).toList(),
      vehicles: _maps(json['vehicles']).map(TransportVehicle.fromJson).toList(),
      studentsOnTransport: _int(summary['studentsOnTransport']),
      seats: _int(summary['seats']),
    );
  }
}

class TransportRider {
  const TransportRider({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.parentPhone,
    required this.className,
    required this.transportRequired,
    this.stopId,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final String parentPhone;
  final String className;
  final bool transportRequired;
  final String? stopId;

  factory TransportRider.fromJson(Map<String, dynamic> json) => TransportRider(
        id: json['id'] as String,
        fullName: '${json['fullName'] ?? ''}',
        admissionNumber: '${json['admissionNumber'] ?? ''}',
        parentPhone: '${json['parentPhone'] ?? ''}',
        className: '${json['className'] ?? ''}',
        transportRequired: json['transportRequired'] == true,
        stopId: _text(json['stopId']),
      );
}

/// GET /transport/routes/:id.
class TransportRouteDetail {
  const TransportRouteDetail({
    required this.id,
    required this.name,
    required this.stops,
    required this.students,
    this.vehicle,
  });

  final String id;
  final String name;
  final TransportVehicle? vehicle;
  final List<TransportStop> stops;
  final List<TransportRider> students;

  String stopName(String? stopId) => stops.where((stop) => stop.id == stopId).firstOrNull?.name ?? 'No stop';

  factory TransportRouteDetail.fromJson(Map<String, dynamic> json) => TransportRouteDetail(
        id: json['id'] as String,
        name: '${json['name'] ?? ''}',
        vehicle: TransportVehicle.maybe(json['vehicle']),
        stops: _maps(json['stops']).map(TransportStop.fromJson).toList(),
        students: _maps(json['students']).map(TransportRider.fromJson).toList(),
      );
}

class VehicleDraft {
  const VehicleDraft({required this.registrationNumber, required this.capacity, this.driverName, this.driverPhone});

  final String registrationNumber;
  final int capacity;
  final String? driverName;
  final String? driverPhone;

  Map<String, dynamic> toJson() => {
        'registrationNumber': registrationNumber.trim(),
        'capacity': capacity,
        'driverName': _text(driverName),
        'driverPhone': _text(driverPhone),
      };
}

class StopDraft {
  StopDraft({this.id, this.name = '', this.pickupTime, this.dropTime});

  StopDraft.from(TransportStop stop)
      : id = stop.id,
        name = stop.name,
        pickupTime = stop.pickupTime,
        dropTime = stop.dropTime;

  /// Kept when editing, so the stop's students stay at it.
  final String? id;
  String name;
  String? pickupTime;
  String? dropTime;

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'name': name.trim(),
        'pickupTime': pickupTime,
        'dropTime': dropTime,
      };
}

class RouteDraft {
  const RouteDraft({required this.name, required this.stops, this.vehicleId});

  final String name;
  final String? vehicleId;
  final List<StopDraft> stops;

  Map<String, dynamic> toJson() => {
        'name': name.trim(),
        'vehicleId': vehicleId,
        'stops': [for (final stop in stops) stop.toJson()],
      };
}

class TransportReportStudent {
  const TransportReportStudent({
    required this.id,
    required this.fullName,
    required this.admissionNumber,
    required this.parentPhone,
    required this.className,
    this.routeName,
  });

  final String id;
  final String fullName;
  final String admissionNumber;
  final String parentPhone;
  final String className;
  final String? routeName;

  factory TransportReportStudent.fromJson(Map<String, dynamic> json) => TransportReportStudent(
        id: json['id'] as String,
        fullName: '${json['fullName'] ?? ''}',
        admissionNumber: '${json['admissionNumber'] ?? ''}',
        parentPhone: '${json['parentPhone'] ?? ''}',
        className: '${json['className'] ?? ''}',
        routeName: _text(json['routeName']),
      );
}

class TransportReportRoute {
  const TransportReportRoute({
    required this.id,
    required this.name,
    required this.students,
    required this.overCapacity,
    required this.withoutStop,
    required this.stops,
    this.vehicle,
    this.capacity,
    this.occupancy,
  });

  final String id;
  final String name;
  final TransportVehicle? vehicle;
  final int students;
  final int? capacity;
  final int? occupancy;
  final bool overCapacity;
  final int withoutStop;
  final List<TransportStop> stops;

  factory TransportReportRoute.fromJson(Map<String, dynamic> json) => TransportReportRoute(
        id: json['id'] as String,
        name: '${json['name'] ?? ''}',
        vehicle: TransportVehicle.maybe(json['vehicle']),
        students: _int(json['students']),
        capacity: json['capacity'] is num ? _int(json['capacity']) : null,
        occupancy: json['occupancy'] is num ? _int(json['occupancy']) : null,
        overCapacity: json['overCapacity'] == true,
        withoutStop: _int(json['withoutStop']),
        stops: _maps(json['stops']).map(TransportStop.fromJson).toList(),
      );
}

/// GET /transport/report.
class TransportReport {
  const TransportReport({
    required this.routes,
    required this.needsRoute,
    required this.notMarked,
    required this.studentsOnTransport,
    required this.routesOverCapacity,
  });

  final List<TransportReportRoute> routes;
  final List<TransportReportStudent> needsRoute;
  final List<TransportReportStudent> notMarked;
  final int studentsOnTransport;
  final int routesOverCapacity;

  factory TransportReport.fromJson(Map<String, dynamic> json) {
    final summary = (json['summary'] as Map?)?.cast<String, dynamic>() ?? const {};
    return TransportReport(
      routes: _maps(json['routes']).map(TransportReportRoute.fromJson).toList(),
      needsRoute: _maps(json['needsRoute']).map(TransportReportStudent.fromJson).toList(),
      notMarked: _maps(json['notMarked']).map(TransportReportStudent.fromJson).toList(),
      studentsOnTransport: _int(summary['studentsOnTransport']),
      routesOverCapacity: _int(summary['routesOverCapacity']),
    );
  }

  /// The web report's CSV columns.
  List<List<Object?>> csvRows() => [
        ['Route', 'Vehicle', 'Driver', 'Driver phone', 'Students', 'Seats', 'Occupancy', 'Without a stop'],
        for (final route in routes)
          [
            route.name,
            route.vehicle?.registrationNumber ?? '-',
            route.vehicle?.driverName ?? '-',
            route.vehicle?.driverPhone ?? '-',
            route.students,
            route.capacity ?? '-',
            route.occupancy == null ? '-' : '${route.occupancy}%',
            route.withoutStop,
          ],
      ];
}

/// A 24-hour "HH:mm" string, the format the API stores.
String clockText(int hour, int minute) =>
    '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
