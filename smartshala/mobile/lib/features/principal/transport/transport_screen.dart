import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/transport_models.dart';
import '../widgets/management_widgets.dart';
import 'route_detail_screen.dart';
import 'route_form_screen.dart';
import 'transport_report_screen.dart';
import 'vehicle_form_screen.dart';

/// Transport: the web Transport page. Routes with their vehicle and riders,
/// vehicles with their driver, and the Transport Report.
class TransportScreen extends StatefulWidget {
  const TransportScreen({super.key});

  @override
  State<TransportScreen> createState() => _TransportScreenState();
}

class _TransportScreenState extends State<TransportScreen> {
  late Future<TransportOverview> _future;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().transport();
  }

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().transport();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _open(Widget screen, {String? savedMessage}) async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (!mounted) return;
    if (changed == true && savedMessage != null) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(savedMessage)));
    }
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<TransportOverview>(
      future: _future,
      builder: (context, snapshot) {
        final data = snapshot.data;
        return Scaffold(
          appBar: AppBar(title: const Text('Transport')),
          floatingActionButton: data == null
              ? null
              : FloatingActionButton.extended(
                  onPressed: () => _tab == 0
                      ? _open(RouteFormScreen(vehicles: data.vehicles), savedMessage: 'Route added.')
                      : _open(const VehicleFormScreen(), savedMessage: 'Vehicle added.'),
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  icon: const Icon(Icons.add_rounded),
                  label: Text(_tab == 0 ? 'Add Route' : 'Add Vehicle'),
                ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) when data == null => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load transport.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(onRefresh: _reload, child: _body(data!)),
          },
        );
      },
    );
  }

  Widget _body(TransportOverview data) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 4,
          children: [
            KpiCard(index: 1, label: 'Routes', value: '${data.routes.length}', icon: Icons.alt_route_rounded),
            KpiCard(index: 4, label: 'Vehicles', value: '${data.vehicles.length}', icon: Icons.directions_bus_rounded),
            KpiCard(index: 3, label: 'Students', value: '${data.studentsOnTransport}', icon: Icons.groups_rounded),
            KpiCard(index: 2, label: 'Seats', value: '${data.seats}', icon: Icons.event_seat_rounded),
          ],
        ),
        const SizedBox(height: 12),
        ManagementActionButton(
          icon: Icons.insights_rounded,
          label: 'Transport Report',
          onTap: () => _open(const TransportReportScreen()),
        ),
        const SizedBox(height: 14),
        SegmentedTabs(
          labels: const ['Routes', 'Vehicles'],
          counts: [data.routes.length, data.vehicles.length],
          index: _tab,
          onChanged: (index) => setState(() => _tab = index),
        ),
        const SizedBox(height: 12),
        if (_tab == 0) ..._routes(data) else ..._vehicles(data),
      ],
    );
  }

  List<Widget> _routes(TransportOverview data) {
    if (data.routes.isEmpty) {
      return [
        const AppCard(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: EmptyView(
            icon: Icons.alt_route_rounded,
            title: 'No routes yet',
            message: 'Add a vehicle, then a route with its stops.',
          ),
        ),
      ];
    }
    return [
      for (final route in data.routes) ...[
        AppCard(
          onTap: () => _open(RouteDetailScreen(routeId: route.id, vehicles: data.vehicles)),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(route.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(
                      '${route.vehicle?.label ?? 'No vehicle'} · ${route.stops.length} ${route.stops.length == 1 ? 'stop' : 'stops'}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    route.overCapacity
                        ? StatusChip(label: route.seatsLabel, color: AppColors.danger, tint: AppColors.dangerSoft)
                        : StatusChip(label: route.seatsLabel, color: AppColors.textSecondary, tint: AppColors.background),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
    ];
  }

  List<Widget> _vehicles(TransportOverview data) {
    if (data.vehicles.isEmpty) {
      return [
        const AppCard(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: EmptyView(icon: Icons.directions_bus_rounded, title: 'No vehicles yet'),
        ),
      ];
    }
    return [
      for (final vehicle in data.vehicles) ...[
        AppCard(
          onTap: () => _open(VehicleFormScreen(existing: vehicle), savedMessage: 'Vehicle saved.'),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
                child: const Icon(Icons.directions_bus_rounded, color: AppColors.danger),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${vehicle.registrationNumber} · ${vehicle.capacity} seats',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(
                      [
                        vehicle.driverName ?? 'No driver',
                        if (vehicle.driverPhone != null) vehicle.driverPhone!,
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    Text(
                      vehicle.routeNames.isEmpty ? 'Not on a route' : vehicle.routeNames.join(', '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.edit_rounded, size: 18, color: AppColors.textMuted),
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
    ];
  }
}
