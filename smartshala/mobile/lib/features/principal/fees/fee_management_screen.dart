import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/fee_models.dart';
import '../data/principal_repository.dart';
import '../widgets/management_widgets.dart';
import 'defaulters_screen.dart';
import 'fee_widgets.dart';
import 'record_payment_screen.dart';
import 'student_fee_ledger_screen.dart';

class _FeesData {
  const _FeesData({required this.overview, required this.defaulters, required this.structures});

  final FeesOverview overview;
  final List<DefaulterRow> defaulters;
  final List<FeeStructureRow> structures;
}

/// Fee Management — the web "Collection Command Center" on a phone: the six
/// KPI cards, Record Payment and the defaulter queue, the collection snapshot
/// with aging buckets, the largest pending accounts and the fee structures.
/// Principal only; structures are created and edited on the web.
class FeeManagementScreen extends StatefulWidget {
  const FeeManagementScreen({super.key});

  @override
  State<FeeManagementScreen> createState() => _FeeManagementScreenState();
}

class _FeeManagementScreenState extends State<FeeManagementScreen> {
  late Future<_FeesData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_FeesData> _load() async {
    final repository = context.read<PrincipalRepository>();
    final results = await Future.wait<Object>([
      repository.feesOverview(),
      repository.defaulters(),
      repository.feeStructures(),
    ]);
    return _FeesData(
      overview: results[0] as FeesOverview,
      defaulters: results[1] as List<DefaulterRow>,
      structures: results[2] as List<FeeStructureRow>,
    );
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(context).push<Object?>(MaterialPageRoute(builder: (_) => screen));
    if (mounted) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fee Management')),
      body: FutureBuilder<_FeesData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return const LoadingView(message: 'Loading fees…');
          }
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(
              message: error is ApiException ? error.message : 'Unable to load fees dashboard.',
              onRetry: _reload,
            );
          }

          final data = snapshot.data!;
          final overview = data.overview;
          final kpis = [
            ('Total Assigned', formatInr(overview.totalDue), Icons.receipt_long_rounded),
            ('Due to Date', formatInr(overview.dueToDate), Icons.event_rounded),
            ('Total Collection', formatInr(overview.totalCollected), Icons.savings_rounded),
            ('Current Outstanding', formatInr(overview.currentOutstanding), Icons.warning_amber_rounded),
            ('Outstanding', formatInr(overview.totalPending), Icons.pending_actions_rounded),
            ('Defaulters', '${overview.defaulterCount}', Icons.groups_rounded),
          ];

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                ResponsiveGrid(
                  phoneColumns: 2,
                  wideColumns: 3,
                  children: [
                    for (var index = 0; index < kpis.length; index++)
                      KpiCard(index: index, label: kpis[index].$1, value: kpis[index].$2, icon: kpis[index].$3),
                  ],
                ),
                const SizedBox(height: 16),
                ResponsiveGrid(
                  phoneColumns: 2,
                  wideColumns: 2,
                  children: [
                    ManagementActionButton(
                      icon: Icons.payments_rounded,
                      label: 'Record Payment',
                      primary: true,
                      onTap: () => _open(const FindStudentForPaymentScreen()),
                    ),
                    ManagementActionButton(
                      icon: Icons.notifications_active_rounded,
                      label: 'Send Reminder',
                      onTap: () => _open(const DefaultersScreen()),
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Collection Snapshot',
                  action: TextButton(onPressed: () => _open(const DefaultersScreen()), child: const Text('Defaulters')),
                ),
                _CollectionSnapshot(overview: overview, defaulters: data.defaulters),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Student Fee Accounts'),
                if (overview.topAccounts.isEmpty)
                  const AppCard(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: EmptyView(icon: Icons.task_alt_rounded, title: 'No pending fee accounts found.'),
                  )
                else
                  for (final account in overview.topAccounts) ...[
                    _AccountCard(
                      account: account,
                      onTap: () => _open(StudentFeeLedgerScreen(studentId: account.studentId)),
                    ),
                    const SizedBox(height: 8),
                  ],
                const SizedBox(height: 14),
                const SectionHeader(title: 'Fee Structures'),
                if (data.structures.isEmpty)
                  const AppCard(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: EmptyView(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'No fee structures found.',
                      message: 'Create one on the web dashboard.',
                    ),
                  )
                else
                  for (final structure in data.structures) ...[
                    _StructureCard(structure: structure),
                    const SizedBox(height: 8),
                  ],
                const SizedBox(height: 6),
                const Text(
                  'Fee structures, concessions and accountants are managed on the web dashboard.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CollectionSnapshot extends StatelessWidget {
  const _CollectionSnapshot({required this.overview, required this.defaulters});

  final FeesOverview overview;
  final List<DefaulterRow> defaulters;

  @override
  Widget build(BuildContext context) {
    final max = [overview.totalCollected, overview.totalPending, 1.0].reduce((a, b) => a > b ? a : b);

    return AppCard(
      child: Column(
        children: [
          _SnapshotBar(label: 'Collected', value: overview.totalCollected, max: max, color: AppColors.success),
          const SizedBox(height: 14),
          _SnapshotBar(label: 'Outstanding', value: overview.totalPending, max: max, color: AppColors.warning),
          const SizedBox(height: 16),
          ResponsiveGrid(
            phoneColumns: 4,
            wideColumns: 4,
            spacing: 8,
            children: [
              for (final bucket in agingBuckets(defaulters))
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppRadii.card),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '${bucket.label} DAYS',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text('${bucket.value}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SnapshotBar extends StatelessWidget {
  const _SnapshotBar({required this.label, required this.value, required this.max, required this.color});

  final String label;
  final double value;
  final double max;
  final Color color;

  @override
  Widget build(BuildContext context) {
    // The web draws at least 4% so a small non-zero amount stays visible.
    final fraction = value <= 0 ? 0.0 : (value / max).clamp(0.04, 1.0);

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            Text(formatInr(value), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 10,
            color: color,
            backgroundColor: const Color(0xFFE8EDF3),
          ),
        ),
      ],
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.account, required this.onTap});

  final FeeAccount account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(account.studentName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(
                      '${account.structureName} - ${account.className}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              feeAssignmentChip(account.status),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: MoneyFigure(label: 'Paid', value: formatInr(account.paid))),
              Expanded(child: MoneyFigure(label: 'Due now', value: formatInr(account.dueNow), color: AppColors.danger)),
              Expanded(child: MoneyFigure(label: 'Balance', value: formatInr(account.balance), color: AppColors.warning)),
            ],
          ),
        ],
      ),
    );
  }
}

class _StructureCard extends StatelessWidget {
  const _StructureCard({required this.structure});

  final FeeStructureRow structure;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(structure.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
              structure.isActive
                  ? const StatusChip(label: 'Active', color: AppColors.success, tint: AppColors.successSoft)
                  : const StatusChip(label: 'Archived', color: AppColors.textSecondary, tint: AppColors.background),
            ],
          ),
          Text(
            '${structure.academicYear} - ${humanizeConstant(structure.frequency)}',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: MoneyFigure(label: 'Total', value: formatInr(structure.totalAmount))),
              Expanded(
                child: MoneyFigure(
                  label: 'Class',
                  value: structure.classLabel,
                ),
              ),
              Expanded(
                child: MoneyFigure(
                  label: 'Due date',
                  value: structure.dueDate == null ? '-' : DateFormat('d MMM yyyy').format(structure.dueDate!),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
