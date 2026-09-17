import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart' show toCsv;
import '../data/transport_models.dart';
import '../reports/report_widgets.dart';

/// The web Transport Report: students and seats per route, riders per stop,
/// and the students whose transport record and route disagree.
class TransportReportScreen extends StatefulWidget {
  const TransportReportScreen({super.key});

  @override
  State<TransportReportScreen> createState() => _TransportReportScreenState();
}

class _TransportReportScreenState extends State<TransportReportScreen> {
  late Future<TransportReport> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().transportReport();
  }

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().transportReport();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<TransportReport>(
      future: _future,
      builder: (context, snapshot) {
        final report = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Transport Report'),
            actions: [
              ExportCsvAction(
                onPressed: report == null || report.routes.isEmpty
                    ? null
                    : () => shareReportCsv(name: 'transport', subject: 'Transport report', csv: toCsv(report.csvRows())),
              ),
            ],
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load the transport report.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(onRefresh: _reload, child: _body(report!)),
          },
        );
      },
    );
  }

  Widget _body(TransportReport report) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 4,
          children: [
            KpiCard(index: 1, label: 'Routes', value: '${report.routes.length}', icon: Icons.alt_route_rounded),
            KpiCard(index: 3, label: 'Students', value: '${report.studentsOnTransport}', icon: Icons.groups_rounded),
            KpiCard(index: 2, label: 'Over capacity', value: '${report.routesOverCapacity}', icon: Icons.warning_amber_rounded),
            KpiCard(index: 4, label: 'Need a route', value: '${report.needsRoute.length}', icon: Icons.person_search_rounded),
          ],
        ),
        const SizedBox(height: 18),
        const SectionHeader(title: 'Routes'),
        if (report.routes.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(icon: Icons.alt_route_rounded, title: 'No routes yet'),
          )
        else
          for (final route in report.routes) ...[
            _RouteCard(route: route),
            const SizedBox(height: 8),
          ],
        if (report.needsRoute.isNotEmpty) ...[
          const SizedBox(height: 10),
          _StudentList(
            title: 'Need a Route (${report.needsRoute.length})',
            copy: 'Their record says they need transport, but they are not on any route.',
            students: report.needsRoute,
          ),
        ],
        if (report.notMarked.isNotEmpty) ...[
          const SizedBox(height: 10),
          _StudentList(
            title: 'On a Route, Not Marked (${report.notMarked.length})',
            copy: 'They ride a route, but their record says they don’t need transport.',
            students: report.notMarked,
          ),
        ],
      ],
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.route});

  final TransportReportRoute route;

  @override
  Widget build(BuildContext context) {
    final vehicle = route.vehicle;
    final StatusChip status = route.overCapacity
        ? const StatusChip(label: 'Over capacity', color: AppColors.danger, tint: AppColors.dangerSoft)
        : vehicle == null
            ? const StatusChip(label: 'No vehicle', color: AppColors.warning, tint: AppColors.warningSoft)
            : const StatusChip(label: 'OK', color: AppColors.success, tint: AppColors.successSoft);

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(route.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
              status,
            ],
          ),
          Text(
            [
              vehicle?.registrationNumber ?? 'No vehicle',
              if (vehicle?.driverName != null) vehicle!.driverName!,
              route.capacity == null ? '${route.students} students' : '${route.students}/${route.capacity} seats',
              if (route.occupancy != null) '${route.occupancy}%',
            ].join(' · '),
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          if (route.stops.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              route.stops.map((stop) => '${stop.name} (${stop.students ?? 0})').join(' → '),
              style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
            ),
          ],
          if (route.withoutStop > 0) ...[
            const SizedBox(height: 6),
            Text('${route.withoutStop} without a stop', style: const TextStyle(fontSize: 12, color: AppColors.warning)),
          ],
        ],
      ),
    );
  }
}

class _StudentList extends StatelessWidget {
  const _StudentList({required this.title, required this.copy, required this.students});

  final String title;
  final String copy;
  final List<TransportReportStudent> students;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: title),
        Text(copy, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 8),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(
            children: [
              for (var index = 0; index < students.length; index++) ...[
                if (index > 0) const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(students[index].fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            Text(
                              [
                                students[index].className,
                                students[index].admissionNumber,
                                if (students[index].routeName != null) students[index].routeName!,
                              ].join(' · '),
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
