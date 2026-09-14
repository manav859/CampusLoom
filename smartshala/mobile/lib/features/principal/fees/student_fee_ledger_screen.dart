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
import 'fee_widgets.dart';
import 'record_payment_screen.dart';

final _day = DateFormat('d MMM yyyy');

/// A student's fee ledger, as on the web ledger page: summary, what is due
/// now, each assignment, concessions, and every payment with its receipt.
/// Record Payment opens the payment form; receipts share as a PDF or go to
/// the parent on WhatsApp. Pops `true` when a payment was recorded.
class StudentFeeLedgerScreen extends StatefulWidget {
  const StudentFeeLedgerScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<StudentFeeLedgerScreen> createState() => _StudentFeeLedgerScreenState();
}

class _StudentFeeLedgerScreenState extends State<StudentFeeLedgerScreen> {
  late Future<FeeLedger> _future;
  bool _changed = false;
  String? _busyReceiptId;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _future = _repository.feeLedger(widget.studentId);
  }

  Future<void> _reload() async {
    final future = _repository.feeLedger(widget.studentId);
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _recordPayment(FeeLedger ledger) async {
    final receipt = await Navigator.of(context).push<PaymentReceipt>(
      MaterialPageRoute(
        builder: (_) => RecordPaymentScreen(
          studentId: ledger.studentId,
          studentName: ledger.studentName,
          balance: ledger.balance,
        ),
      ),
    );
    if (receipt == null || !mounted) return;
    _changed = true;
    await _reload();
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (_) => _ReceiptDialog(receipt: receipt, studentName: ledger.studentName, repository: _repository),
    );
  }

  Future<void> _share(LedgerPayment payment) async {
    setState(() => _busyReceiptId = payment.receiptId);
    try {
      await shareReceiptPdf(_repository, receiptId: payment.receiptId!, receiptNo: payment.receiptNo ?? payment.receiptId!);
    } on ApiException catch (error) {
      if (mounted) showFeeToast(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busyReceiptId = null);
    }
  }

  Future<void> _sendWhatsApp(LedgerPayment payment) async {
    setState(() => _busyReceiptId = payment.receiptId);
    try {
      await _repository.sendReceiptOnWhatsApp(payment.receiptId!);
      if (mounted) showFeeToast(context, 'Receipt ${payment.receiptNo ?? ''} sent on WhatsApp.');
    } on ApiException catch (error) {
      if (mounted) showFeeToast(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busyReceiptId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Fee Ledger')),
        body: FutureBuilder<FeeLedger>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
              return const LoadingView();
            }
            if (snapshot.hasError) {
              final error = snapshot.error;
              return ErrorView(
                message: error is ApiException ? error.message : 'Could not load this ledger.',
                onRetry: _reload,
              );
            }
            final ledger = snapshot.data!;
            return RefreshIndicator(onRefresh: _reload, child: _body(ledger));
          },
        ),
      ),
    );
  }

  Widget _body(FeeLedger ledger) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(ledger.studentName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  ),
                  feeAssignmentChip(ledger.status),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '${ledger.className} - Admission ${ledger.admissionNumber}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: MoneyFigure(label: 'Total fees', value: formatInr(ledger.total))),
                  Expanded(child: MoneyFigure(label: 'Paid', value: formatInr(ledger.paid), color: AppColors.success)),
                  Expanded(
                    child: MoneyFigure(
                      label: 'Balance',
                      value: formatInr(ledger.balance),
                      color: ledger.balance > 0 ? AppColors.warning : AppColors.success,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: ledger.balance > 0 ? () => _recordPayment(ledger) : null,
                icon: const Icon(Icons.payments_rounded, size: 18),
                label: const Text('Record Payment'),
              ),
            ],
          ),
        ),
        if (ledger.total > 0) ...[
          const SizedBox(height: 16),
          SectionHeader(
            title: 'Current Due',
            action: ledger.currentOutstanding > 0
                ? const StatusChip(label: 'Payment due', color: AppColors.danger, tint: AppColors.dangerSoft)
                : const StatusChip(label: 'Up to date', color: AppColors.success, tint: AppColors.successSoft),
          ),
          AppCard(
            child: ResponsiveGrid(
              phoneColumns: 2,
              wideColumns: 4,
              spacing: 14,
              children: [
                MoneyFigure(
                  label: 'Due now',
                  value: formatInr(ledger.currentOutstanding),
                  color: ledger.currentOutstanding > 0 ? AppColors.danger : AppColors.success,
                ),
                MoneyFigure(label: 'Due to date', value: formatInr(ledger.dueToDate)),
                MoneyFigure(label: 'Collected of due', value: formatInr(ledger.currentCollected), color: AppColors.success),
                MoneyFigure(label: 'Upcoming', value: formatInr(ledger.upcomingDue), color: AppColors.textSecondary),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        const SectionHeader(title: 'Assignments'),
        if (ledger.assignments.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: EmptyView(
              icon: Icons.receipt_long_outlined,
              title: 'No fees assigned',
              message: 'Assign a fee structure on the web dashboard.',
            ),
          )
        else
          for (final assignment in ledger.assignments) ...[
            _AssignmentCard(assignment: assignment),
            const SizedBox(height: 8),
          ],
        if (ledger.adjustments.isNotEmpty) ...[
          const SizedBox(height: 8),
          const SectionHeader(title: 'Concessions and Discounts'),
          for (final adjustment in ledger.adjustments) ...[
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${humanizeConstant(adjustment.type)} · ${adjustment.structureName}',
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          [
                            if (adjustment.createdAt != null) _day.format(adjustment.createdAt!),
                            adjustment.reason,
                            if (adjustment.recordedBy != null) adjustment.recordedBy!,
                          ].join(' · '),
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatInr(adjustment.amount),
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.warning),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
        const SizedBox(height: 8),
        const SectionHeader(title: 'Transaction Ledger'),
        if (ledger.payments.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: EmptyView(
              icon: Icons.payments_outlined,
              title: 'No fee payments recorded',
              message: 'Record the first payment to generate a receipt and update the balance.',
            ),
          )
        else
          for (final payment in ledger.payments) ...[
            _PaymentCard(
              payment: payment,
              busy: payment.receiptId != null && _busyReceiptId == payment.receiptId,
              onShare: payment.receiptId == null ? null : () => _share(payment),
              onWhatsApp: payment.receiptId == null ? null : () => _sendWhatsApp(payment),
            ),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.assignment});

  final LedgerAssignment assignment;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(assignment.structureName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
              feeAssignmentChip(assignment.status),
            ],
          ),
          if (assignment.transportFee > 0)
            Text(
              'Base fee: ${formatInr(assignment.baseFee, compact: false)} · '
              'Transportation fee: ${formatInr(assignment.transportFee, compact: false)}',
              style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: MoneyFigure(label: 'Total', value: formatInr(assignment.total))),
              Expanded(child: MoneyFigure(label: 'Paid', value: formatInr(assignment.paid))),
              Expanded(child: MoneyFigure(label: 'Balance', value: formatInr(assignment.balance))),
            ],
          ),
          if (assignment.dueDate != null) ...[
            const SizedBox(height: 6),
            Text('Due ${_day.format(assignment.dueDate!)}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment, required this.busy, this.onShare, this.onWhatsApp});

  final LedgerPayment payment;
  final bool busy;
  final VoidCallback? onShare;
  final VoidCallback? onWhatsApp;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 6),
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
                    Text(
                      formatInr(payment.amount, compact: false),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.success),
                    ),
                    Text(
                      [
                        if (payment.paidAt != null) _day.format(payment.paidAt!),
                        humanizeConstant(payment.mode),
                        payment.componentLabel,
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    Text(
                      [
                        'Receipt ${payment.receiptNo ?? 'Pending'}',
                        if (payment.reference != null) 'Ref ${payment.reference}',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Balance after', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    Text(formatInr(payment.balanceAfter), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
          if (onShare != null)
            Wrap(
              alignment: WrapAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: busy ? null : onShare,
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 17),
                  label: const Text('Receipt PDF'),
                ),
                TextButton.icon(
                  onPressed: busy ? null : onWhatsApp,
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFF128C7E)),
                  icon: const Icon(Icons.chat_rounded, size: 17),
                  label: const Text('WhatsApp'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// The web modal's success view: receipt number, amounts and status, with
/// the receipt's share and WhatsApp actions.
class _ReceiptDialog extends StatefulWidget {
  const _ReceiptDialog({required this.receipt, required this.studentName, required this.repository});

  final PaymentReceipt receipt;
  final String studentName;
  final PrincipalRepository repository;

  @override
  State<_ReceiptDialog> createState() => _ReceiptDialogState();
}

class _ReceiptDialogState extends State<_ReceiptDialog> {
  bool _busy = false;
  bool _sent = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (error) {
      if (mounted) showFeeToast(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = widget.receipt;
    final lines = [
      ('Receipt No', receipt.receiptNo),
      ('Amount Paid', formatInr(receipt.amount, compact: false)),
      ('Total Paid', formatInr(receipt.paid, compact: false)),
      ('Remaining Balance', formatInr(receipt.balance, compact: false)),
      ('Status', humanizeConstant(receipt.status)),
    ];

    return AlertDialog(
      title: const Text('Payment Recorded'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.studentName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          for (final (label, value) in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                  Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text(
            receipt.whatsAppQueued || _sent
                ? 'WhatsApp receipt sent or queued for parent'
                : 'WhatsApp receipt not sent automatically',
            style: const TextStyle(fontSize: 12, color: Color(0xFF128C7E), fontWeight: FontWeight.w600),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy
              ? null
              : () => _run(() => shareReceiptPdf(widget.repository, receiptId: receipt.receiptId, receiptNo: receipt.receiptNo)),
          child: const Text('Receipt PDF'),
        ),
        if (!receipt.whatsAppQueued)
          TextButton(
            onPressed: _busy || _sent
                ? null
                : () => _run(() async {
                      await widget.repository.sendReceiptOnWhatsApp(receipt.receiptId);
                      if (mounted) setState(() => _sent = true);
                    }),
            child: Text(_sent ? 'WhatsApp sent' : 'Send WhatsApp'),
          ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          style: FilledButton.styleFrom(minimumSize: const Size(88, 42)),
          child: const Text('Done'),
        ),
      ],
    );
  }
}
