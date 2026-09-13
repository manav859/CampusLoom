import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/salary_models.dart';
import '../data/teacher_repository.dart';

final _rupees = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _rupeesExact = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);

/// Whole rupees unless there are paise, as on the web Salary Details page.
String formatRupees(double value) =>
    value == value.roundToDouble() ? _rupees.format(value) : _rupeesExact.format(value);

/// The teacher's own slips, recorded by the principal on the web Payroll page.
/// The web "My Salary" page shows the same data.
class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});

  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  late Future<MySalary> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<TeacherRepository>().mySalary();
  }

  Future<void> _refresh() async {
    final future = context.read<TeacherRepository>().mySalary();
    setState(() => _future = future);
    await future.then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Salary Details')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<MySalary>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const LoadingView(message: 'Loading your salary…');
            }

            if (snapshot.hasError) {
              final error = snapshot.error;
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.18),
                  ErrorView(
                    message: error is ApiException ? error.message : 'Could not load your salary.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final salary = snapshot.data!;
            final latest = salary.latest;
            if (latest == null) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.14),
                  const EmptyView(
                    icon: Icons.receipt_long_rounded,
                    title: 'No salary slips yet',
                    message: 'Your slips appear here once the school records them.',
                  ),
                ],
              );
            }

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _LatestSlipCard(slip: latest),
                const SizedBox(height: 12),
                KpiCard(
                  index: 3,
                  label: 'Paid in ${salary.year}',
                  value: formatRupees(salary.paidThisYear),
                  icon: Icons.account_balance_wallet_rounded,
                ),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Salary Slips',
                  action: Text(
                    '${salary.slips.length}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                for (var index = 0; index < salary.slips.length; index++) ...[
                  if (index > 0) const SizedBox(height: 8),
                  SlipRow(
                    slip: salary.slips[index],
                    onTap: () => _showSlip(context, salary.slips[index]),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  void _showSlip(BuildContext context, SalarySlip slip) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: _SlipBreakdown(slip: slip),
        ),
      ),
    );
  }
}

class _LatestSlipCard extends StatelessWidget {
  const _LatestSlipCard({required this.slip});

  final SalarySlip slip;

  @override
  Widget build(BuildContext context) {
    return AppCard(child: _SlipBreakdown(slip: slip, eyebrow: 'Latest slip'));
  }
}

class _SlipBreakdown extends StatelessWidget {
  const _SlipBreakdown({required this.slip, this.eyebrow});

  final SalarySlip slip;
  final String? eyebrow;

  @override
  Widget build(BuildContext context) {
    final month = DateFormat('MMMM yyyy').format(slip.monthStart);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    eyebrow == null ? month : '$eyebrow · $month',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      formatRupees(slip.netPay),
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, height: 1.15),
                    ),
                  ),
                  const Text('Net pay', style: TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                ],
              ),
            ),
            SlipStatusChip(slip: slip),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
          child: Column(
            children: [
              _BreakdownLine(label: 'Basic pay', value: formatRupees(slip.basicPay)),
              const Divider(),
              _BreakdownLine(label: 'Allowances', value: '+ ${formatRupees(slip.allowances)}'),
              const Divider(),
              _BreakdownLine(
                label: 'Deductions',
                value: '− ${formatRupees(slip.deductions)}',
                color: AppColors.danger,
              ),
              const Divider(),
              _BreakdownLine(label: 'Net pay', value: formatRupees(slip.netPay), strong: true),
            ],
          ),
        ),
        if (slip.note != null && slip.note!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            'Note: ${slip.note}',
            style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _BreakdownLine extends StatelessWidget {
  const _BreakdownLine({
    required this.label,
    required this.value,
    this.strong = false,
    this.color = AppColors.textPrimary,
  });

  final String label;
  final String value;
  final bool strong;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: strong ? AppColors.background : null,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
                color: strong ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
              color: strong ? AppColors.textPrimary : color,
            ),
          ),
        ],
      ),
    );
  }
}

class SlipStatusChip extends StatelessWidget {
  const SlipStatusChip({super.key, required this.slip});

  final SalarySlip slip;

  @override
  Widget build(BuildContext context) {
    if (!slip.isPaid) {
      return const StatusChip(
        label: 'Pending',
        color: AppColors.warning,
        tint: AppColors.warningSoft,
        icon: Icons.schedule_rounded,
      );
    }
    final paidOn = slip.paidOn == null ? null : DateTime.tryParse(slip.paidOn!);
    return StatusChip(
      label: paidOn == null ? 'Paid' : 'Paid ${DateFormat('d MMM').format(paidOn)}',
      color: AppColors.success,
      tint: AppColors.successSoft,
      icon: Icons.check_rounded,
    );
  }
}

class SlipRow extends StatelessWidget {
  const SlipRow({super.key, required this.slip, this.onTap});

  final SalarySlip slip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: const Icon(Icons.receipt_long_rounded, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('MMMM yyyy').format(slip.monthStart),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    formatRupees(slip.netPay),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SlipStatusChip(slip: slip),
          const SizedBox(width: 2),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}
