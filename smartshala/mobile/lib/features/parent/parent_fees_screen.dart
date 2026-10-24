import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_chips.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';

final _money = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

StatusChip _feeChip(String status) => switch (status) {
      'PAID' => const StatusChip(label: 'Paid', color: AppColors.success, tint: AppColors.successSoft),
      'PARTIAL' => const StatusChip(label: 'Partial', color: AppColors.warning, tint: AppColors.warningSoft),
      _ => const StatusChip(label: 'Due', color: AppColors.danger, tint: AppColors.dangerSoft),
    };

/// The Fees tab for the selected child: what is owed, a Pay button that opens
/// the external Razorpay page, and the payment history with receipt downloads.
class ParentFeesScreen extends StatefulWidget {
  const ParentFeesScreen({super.key, required this.child});

  final ParentChild child;

  @override
  State<ParentFeesScreen> createState() => _ParentFeesScreenState();
}

class _ParentFeesScreenState extends State<ParentFeesScreen> {
  ChildFees? _data;
  String? _error;
  bool _loading = true;
  String? _payingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(ParentFeesScreen old) {
    super.didUpdateWidget(old);
    if (old.child.id != widget.child.id) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ParentRepository>().fees(widget.child.id);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _toast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.textPrimary,
      ));
  }

  Future<void> _pay(FeeAssignment assignment) async {
    setState(() => _payingId = assignment.id);
    try {
      final url = await context.read<ParentRepository>().feePayLink(widget.child.id, assignment.id);
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened) {
        _toast('Could not open the payment page.', isError: true);
      } else {
        _toast('Complete the payment in your browser, then pull down to refresh.');
      }
    } catch (e) {
      _toast(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _payingId = null);
    }
  }

  Future<void> _downloadReceipt(FeePayment payment) async {
    final id = payment.receiptId;
    if (id == null) return;
    try {
      final bytes = await context.read<ParentRepository>().feeReceiptPdf(widget.child.id, payment.paymentId);
      final directory = await getTemporaryDirectory();
      final name = payment.receiptNo ?? payment.paymentId;
      final file = File('${directory.path}/receipt-$name.pdf');
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path, mimeType: 'application/pdf')], subject: 'Fee receipt $name'),
      );
    } catch (e) {
      _toast(e.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final data = _data!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          _SummaryCard(fees: data),
          if (data.assignments.isNotEmpty) ...[
            const SizedBox(height: 18),
            const _SectionLabel('Fee breakdown'),
            const SizedBox(height: 10),
            for (final a in data.assignments) ...[
              _AssignmentCard(
                assignment: a,
                paying: _payingId == a.id,
                onPay: _payingId == null ? () => _pay(a) : null,
              ),
              const SizedBox(height: 10),
            ],
          ],
          const SizedBox(height: 8),
          const _SectionLabel('Payment history'),
          const SizedBox(height: 10),
          if (data.payments.isEmpty)
            const HomeSurface(
              padding: EdgeInsets.all(18),
              child: Text(
                'No payments yet.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
              ),
            )
          else
            for (final p in data.payments) ...[
              _PaymentCard(payment: p, onReceipt: p.receiptId == null ? null : () => _downloadReceipt(p)),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
      );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.fees});

  final ChildFees fees;

  @override
  Widget build(BuildContext context) {
    final cleared = fees.balance <= 0;
    return HomeSurface(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Total outstanding',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              _feeChip(cleared ? 'PAID' : fees.status),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _money.format(fees.balance),
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w800,
              color: cleared ? AppColors.success : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _Figure(label: 'Total', value: _money.format(fees.total)),
              const SizedBox(width: 20),
              _Figure(label: 'Paid', value: _money.format(fees.paid), color: AppColors.success),
            ],
          ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, this.color = AppColors.textPrimary});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.4)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.assignment, required this.paying, this.onPay});

  final FeeAssignment assignment;
  final bool paying;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  assignment.name,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              _feeChip(assignment.status),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MiniFigure(label: 'Due', value: _money.format(assignment.pending), emphasise: assignment.payable),
              ),
              Expanded(child: _MiniFigure(label: 'Paid', value: _money.format(assignment.paid))),
              Expanded(child: _MiniFigure(label: 'Total', value: _money.format(assignment.total))),
            ],
          ),
          if (assignment.payable) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: paying ? null : onPay,
                icon: paying
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.lock_rounded, size: 18),
                label: Text(paying ? 'Opening…' : 'Pay ${_money.format(assignment.pending)}'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MiniFigure extends StatelessWidget {
  const _MiniFigure({required this.label, required this.value, this.emphasise = false});

  final String label;
  final String value;
  final bool emphasise;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.3)),
        const SizedBox(height: 2),
        Text(value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: emphasise ? AppColors.danger : AppColors.textPrimary,
            )),
      ],
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment, this.onReceipt});

  final FeePayment payment;
  final VoidCallback? onReceipt;

  @override
  Widget build(BuildContext context) {
    final date = payment.paidAt == null ? '' : DateFormat('d MMM yyyy').format(payment.paidAt!);
    final sub = [
      if (date.isNotEmpty) date,
      payment.mode.replaceAll('_', ' ').toLowerCase(),
      if (payment.receiptNo != null) payment.receiptNo!,
    ].join('  ·  ');

    return HomeSurface(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _money.format(payment.amount),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          if (onReceipt != null)
            IconButton(
              onPressed: onReceipt,
              icon: const Icon(Icons.download_rounded, color: AppColors.primary),
              tooltip: 'Download receipt',
            ),
        ],
      ),
    );
  }
}
