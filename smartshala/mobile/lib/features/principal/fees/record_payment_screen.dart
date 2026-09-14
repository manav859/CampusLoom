import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/fee_models.dart';
import '../data/principal_repository.dart';
import '../data/student_models.dart';
import 'student_fee_ledger_screen.dart';

/// Record Payment starts the way the web modal does: find the student, then
/// open their ledger, where the payment is entered against the balance.
class FindStudentForPaymentScreen extends StatefulWidget {
  const FindStudentForPaymentScreen({super.key});

  @override
  State<FindStudentForPaymentScreen> createState() => _FindStudentForPaymentScreenState();
}

class _FindStudentForPaymentScreenState extends State<FindStudentForPaymentScreen> {
  Timer? _debounce;
  List<StudentRow> _rows = const [];
  bool _loading = true;
  String? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _search(String query) async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // The web modal's query: eight matches at a time.
      final page = await context.read<PrincipalRepository>().students(limit: 8, search: query);
      if (!mounted || generation != _generation) return;
      setState(() {
        _rows = page.items;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _rows = const [];
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () => _search(value.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Record Payment')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          const Text(
            'Search student, then open fee ledger.',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          TextField(
            autofocus: true,
            onChanged: _onChanged,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              hintText: 'Search by student name, admission no, or phone',
              prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: LoadingView())
          else if (_error != null)
            ErrorView(message: _error!, onRetry: () => _search(''))
          else if (_rows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: EmptyView(icon: Icons.person_search_rounded, title: 'No students found.'),
            )
          else
            for (final row in _rows) ...[
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                onTap: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute<void>(builder: (_) => StudentFeeLedgerScreen(studentId: row.id)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(row.fullName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text(
                            [row.className, row.admissionNumber, if (row.parentPhone?.isNotEmpty ?? false) row.parentPhone!]
                                .join(' | '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('Open', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

/// The payment form (web PaymentModal): amount up to the balance, fee type,
/// date, mode and the reference that mode requires, and the WhatsApp receipt
/// toggle. Pops the [PaymentReceipt] once the server has recorded it.
class RecordPaymentScreen extends StatefulWidget {
  const RecordPaymentScreen({super.key, required this.studentId, required this.studentName, required this.balance});

  final String studentId;
  final String studentName;
  final double balance;

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  final _amount = TextEditingController();
  final _reference = TextEditingController();

  /// One key for this form: resubmitting after a failure or a timeout can
  /// never record the same payment twice.
  final _idempotencyKey = newIdempotencyKey();

  PaymentMode _mode = PaymentMode.cash;
  bool _isTransport = false;
  DateTime _paidOn = DateTime.now();
  bool _sendReceipt = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amount.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  double? get _amountValue => double.tryParse(_amount.text.trim());

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _paidOn,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
    if (picked != null) setState(() => _paidOn = picked);
  }

  Future<void> _submit() async {
    final problem = validatePayment(
      amount: _amountValue,
      balance: widget.balance,
      mode: _mode,
      reference: _reference.text,
    );
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final receipt = await context.read<PrincipalRepository>().recordPayment(
            NewPayment(
              studentId: widget.studentId,
              amount: _amountValue!,
              mode: _mode,
              paidOn: _paidOn,
              isTransport: _isTransport,
              reference: _reference.text,
              sendReceiptOnWhatsApp: _sendReceipt,
            ),
            idempotencyKey: _idempotencyKey,
          );
      if (mounted) Navigator.of(context).pop(receipt);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = _amountValue ?? 0;
    final balanceAfter = (widget.balance - amount.clamp(0, widget.balance)).clamp(0, widget.balance);

    return Scaffold(
      appBar: AppBar(title: const Text('Record Payment')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text(widget.studentName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(
            'Balance: ${formatInr(widget.balance, compact: false)}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            decoration: const InputDecoration(labelText: 'Amount', hintText: '0'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<bool>(
            initialValue: _isTransport,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Fee Type'),
            items: const [
              DropdownMenuItem(value: false, child: Text('School fee')),
              DropdownMenuItem(value: true, child: Text('Transportation fee')),
            ],
            onChanged: (value) => setState(() => _isTransport = value ?? false),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(AppRadii.card),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Payment Date',
                suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
              ),
              child: Text(DateFormat('d MMM yyyy').format(_paidOn)),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<PaymentMode>(
            initialValue: _mode,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Mode'),
            items: [
              for (final mode in PaymentMode.values) DropdownMenuItem(value: mode, child: Text(mode.label)),
            ],
            onChanged: (value) => setState(() {
              _mode = value ?? PaymentMode.cash;
              _reference.clear();
            }),
          ),
          if (_mode.referenceLabel != null) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _reference,
              decoration: InputDecoration(labelText: _mode.referenceLabel),
            ),
          ],
          const SizedBox(height: 12),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: CheckboxListTile(
              value: _sendReceipt,
              onChanged: (value) => setState(() => _sendReceipt = value ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('Send receipt to parent on WhatsApp', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
              subtitle: const Text('Enabled by default for receipt workflows.', style: TextStyle(fontSize: 12)),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(AppRadii.card)),
            child: Column(
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('Balance after payment', style: TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                    Text(formatInr(balanceAfter, compact: false), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 4),
                const Row(
                  children: [
                    Expanded(child: Text('Receipt number', style: TextStyle(fontSize: 12, color: AppColors.textSecondary))),
                    Text('Generated on save', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
              child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
            ),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? 'Recording payment…' : 'Record Payment'),
          ),
        ],
      ),
    );
  }
}
