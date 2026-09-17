import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/transport_models.dart';
import '../widgets/management_widgets.dart';
import 'assign_students_screen.dart';
import 'route_form_screen.dart';

/// One route: its vehicle and driver, stops in order, and who rides it.
class RouteDetailScreen extends StatefulWidget {
  const RouteDetailScreen({super.key, required this.routeId, required this.vehicles});

  final String routeId;
  final List<TransportVehicle> vehicles;

  @override
  State<RouteDetailScreen> createState() => _RouteDetailScreenState();
}

class _RouteDetailScreenState extends State<RouteDetailScreen> {
  late Future<TransportRouteDetail> _future;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().transportRoute(widget.routeId);
  }

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().transportRoute(widget.routeId);
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  void _toast(String message, {Color color = AppColors.success}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(backgroundColor: color, content: Text(message)));
  }

  Future<void> _call(String phone) async {
    final opened = await launchUrl(Uri(scheme: 'tel', path: phone), mode: LaunchMode.externalApplication);
    if (!opened && mounted) _toast('No app on this phone can open that.', color: AppColors.danger);
  }

  Future<void> _edit(TransportRouteDetail route) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => RouteFormScreen(vehicles: widget.vehicles, existing: route)),
    );
    if (changed != true || !mounted) return;
    final future = context.read<PrincipalRepository>().transportRoute(route.id);
    setState(() {
      _future = future;
    });
    try {
      await future;
      if (mounted) _toast('Route saved.');
    } on ApiException catch (error) {
      // Deleted: there is nothing left to show here.
      if (error.statusCode == 404 && mounted) Navigator.of(context).pop();
    }
  }

  Future<void> _addStudents(TransportRouteDetail route) async {
    final added = await Navigator.of(context).push<int>(
      MaterialPageRoute(builder: (_) => AssignStudentsScreen(route: route)),
    );
    if (added == null || !mounted) return;
    _toast('$added ${added == 1 ? 'student' : 'students'} added to ${route.name}.');
    await _reload();
  }

  Future<void> _remove(TransportRider student) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove from route?'),
        content: Text('${student.fullName} will no longer be on this route.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busyId = student.id);
    try {
      await context.read<PrincipalRepository>().removeFromRoute(student.id);
      if (!mounted) return;
      _toast('${student.fullName} removed from the route.');
      await _reload();
    } on ApiException catch (error) {
      if (mounted) _toast(error.message, color: AppColors.danger);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<TransportRouteDetail>(
      future: _future,
      builder: (context, snapshot) {
        final route = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: Text(route?.name ?? 'Route'),
            actions: [
              if (route != null)
                IconButton(tooltip: 'Edit route', onPressed: () => _edit(route), icon: const Icon(Icons.edit_rounded)),
            ],
          ),
          floatingActionButton: route == null
              ? null
              : FloatingActionButton.extended(
                  onPressed: () => _addStudents(route),
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  icon: const Icon(Icons.person_add_alt_1_rounded),
                  label: const Text('Add Students'),
                ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) when route == null => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load the route.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(onRefresh: _reload, child: _body(route!)),
          },
        );
      },
    );
  }

  Widget _body(TransportRouteDetail route) {
    final vehicle = route.vehicle;
    final overCapacity = vehicle != null && route.students.length > vehicle.capacity;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        InfoSection(title: 'Vehicle', lines: [
          ('Vehicle', vehicle?.registrationNumber ?? 'No vehicle'),
          if (vehicle != null) ('Seats', '${route.students.length} of ${vehicle.capacity} used'),
          if (vehicle != null) ('Driver', vehicle.driverName ?? 'Not set'),
          if (vehicle?.driverPhone != null) ('Driver phone', vehicle!.driverPhone!),
        ]),
        if (overCapacity)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'More students than seats',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.danger),
            ),
          ),
        if (vehicle?.driverPhone != null) ...[
          ManagementActionButton(
            icon: Icons.call_rounded,
            label: 'Call ${vehicle!.driverName ?? 'Driver'}',
            onTap: () => _call(vehicle.driverPhone!),
          ),
          const SizedBox(height: 18),
        ],
        SectionHeader(title: 'Stops (${route.stops.length})'),
        if (route.stops.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: EmptyView(icon: Icons.place_outlined, title: 'No stops yet', message: 'Edit the route to add its stops.'),
          )
        else
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(
              children: [
                for (final stop in route.stops)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: CircleAvatar(
                      radius: 13,
                      backgroundColor: AppColors.primarySoft,
                      child: Text('${stop.sequence}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ),
                    title: Text(stop.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: stop.times.isEmpty ? null : Text(stop.times),
                    trailing: Text(
                      '${route.students.where((student) => student.stopId == stop.id).length}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 18),
        SectionHeader(title: 'Students (${route.students.length})'),
        if (route.students.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: EmptyView(icon: Icons.groups_outlined, title: 'Nobody rides this route yet'),
          )
        else
          for (final student in route.students) ...[
            AppCard(
              padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(student.fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        Text(
                          '${student.className} · ${route.stopName(student.stopId)}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                        if (!student.transportRequired)
                          const Text(
                            'Not marked as needing transport',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.warning),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove from route',
                    onPressed: _busyId == null ? () => _remove(student) : null,
                    icon: _busyId == student.id
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.person_remove_alt_1_rounded, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}
