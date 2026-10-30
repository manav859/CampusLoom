import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/billing_models.dart';
import '../data/principal_repository.dart';

/// Billing — a read-only view of the school's SmartShala subscription: status,
/// plan, usage and past invoices. Subscribing and paying stay on the web.
class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  late Future<BillingOverview> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().billingOverview();
  }

  Future<void> _refresh() async {
    final future = context.read<PrincipalRepository>().billingOverview();
    setState(() => _future = future);
    await future.catchError((Object error) => throw error);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: FutureBuilder<BillingOverview>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingView(message: 'Loading subscription…');
          }
          if (snapshot.hasError) {
            return ListView(children: [
              const SizedBox(height: 120),
              ErrorView(
                message: snapshot.error is ApiException ? (snapshot.error as ApiException).message : 'Could not load billing.',
                onRetry: _refresh,
              ),
            ]);
          }

          final overview = snapshot.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _SubscriptionCard(overview: overview),
                const SizedBox(height: 12),
                _UsageCard(overview: overview),
                const SizedBox(height: 18),
                const Text('Invoices', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 10),
                if (overview.invoices.isEmpty)
                  const AppCard(
                    padding: EdgeInsets.symmetric(vertical: 22),
                    child: EmptyView(icon: Icons.receipt_long_outlined, title: 'No invoices yet', message: 'Invoices appear here once billed.'),
                  )
                else
                  ...overview.invoices.map((invoice) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _InvoiceCard(invoice: invoice),
                      )),
              ],
            ),
          );
        },
      ),
    );
  }
}

String _money(int minor, String currency) {
  final symbol = currency == 'INR' ? '₹' : '$currency ';
  final amount = minor / 100;
  final formatted = NumberFormat.decimalPattern('en_IN').format(amount);
  return '$symbol$formatted';
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.overview});

  final BillingOverview overview;

  static final _dayFormat = DateFormat('d MMM yyyy');

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(overview.planName,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              ),
              StatusChip(label: overview.status.label, color: overview.status.color, tint: overview.status.tint),
            ],
          ),
          const SizedBox(height: 6),
          Text('${_money(overview.priceMinor, overview.currency)} ${overview.intervalLabel}',
              style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 16, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  overview.periodEnd == null
                      ? '${overview.daysRemaining} days remaining'
                      : '${overview.daysRemaining} days remaining • renews ${_dayFormat.format(overview.periodEnd!)}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary),
                ),
              ),
            ],
          ),
          if (overview.cancelAtPeriodEnd) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: AppColors.warningSoft, borderRadius: BorderRadius.circular(10)),
              child: const Text('Set to cancel at the end of the current period.',
                  style: TextStyle(fontSize: 12, color: AppColors.textPrimary)),
            ),
          ],
        ],
      ),
    );
  }
}

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.overview});

  final BillingOverview overview;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Expanded(child: _metric('Students', overview.students, overview.maxStudents)),
          Container(width: 1, height: 42, color: AppColors.border),
          Expanded(child: _metric('Staff', overview.staff, overview.maxStaff)),
        ],
      ),
    );
  }

  Widget _metric(String label, int used, int? max) {
    final over = max != null && used > max;
    return Column(
      children: [
        Text(
          max == null ? '$used' : '$used / $max',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: over ? AppColors.danger : AppColors.textPrimary),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice});

  final BillingInvoice invoice;

  static final _dayFormat = DateFormat('d MMM yyyy');

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(invoice.number,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text(
                  invoice.issuedAt == null ? invoice.planName : '${invoice.planName} • ${_dayFormat.format(invoice.issuedAt!)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(_money(invoice.totalMinor, invoice.currency),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 4),
              StatusChip(label: invoice.status.label, color: invoice.status.color, tint: invoice.status.tint),
            ],
          ),
        ],
      ),
    );
  }
}
