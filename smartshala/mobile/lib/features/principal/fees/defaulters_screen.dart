import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/list_with_header.dart';
import '../../../core/widgets/state_views.dart';
import '../data/fee_models.dart';
import '../data/principal_repository.dart';
import '../widgets/management_widgets.dart';
import 'fee_widgets.dart';
import 'student_fee_ledger_screen.dart';

/// The web Defaulter Follow-up Queue: every pending active fee account,
/// filtered and sorted locally, with a WhatsApp reminder per row.
class DefaultersScreen extends StatefulWidget {
  const DefaultersScreen({super.key});

  @override
  State<DefaultersScreen> createState() => _DefaultersScreenState();
}

class _DefaultersScreenState extends State<DefaultersScreen> {
  late Future<List<DefaulterRow>> _future;
  final _searchController = TextEditingController();

  String _search = '';
  String? _class;
  String? _status;
  DueAge? _dueAge;
  DefaulterSort _sort = DefaulterSort.overdueDesc;
  String? _sendingId;

  static const _statuses = [('PENDING', 'Pending Fees'), ('PARTIAL', 'Partial Fees'), ('OVERDUE', 'Overdue Fees')];

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _future = _repository.defaulters();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final future = _repository.defaulters();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  bool get _hasFilters =>
      _search.isNotEmpty || _class != null || _status != null || _dueAge != null || _sort != DefaulterSort.overdueDesc;

  Future<void> _sendReminder(DefaulterRow row) async {
    setState(() => _sendingId = row.studentId);
    try {
      await _repository.sendFeeReminder(row);
      if (mounted) showFeeToast(context, 'WhatsApp reminder sent to ${row.name}.');
    } on ApiException catch (error) {
      if (mounted) showFeeToast(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _sendingId = null);
    }
  }

  Future<void> _pick<T>(String title, List<({String label, T value})> options, T selected, ValueChanged<T> apply) async {
    final picked = await pickFromSheet<T>(context, title: title, options: options, selected: selected);
    if (picked != null) setState(() => apply(picked.value));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Defaulter Follow-up')),
      body: FutureBuilder<List<DefaulterRow>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(
              message: error is ApiException ? error.message : 'Unable to load defaulters.',
              onRetry: _reload,
            );
          }

          final rows = snapshot.data!;
          final classes = rows.map((row) => row.className).where((name) => name.isNotEmpty).toSet().toList()..sort();
          final visible = filterDefaulters(
            rows,
            search: _search,
            className: _class,
            status: _status,
            dueAge: _dueAge,
            sort: _sort,
          );

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListWithHeader(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              header: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _searchController,
                    onChanged: (value) => setState(() => _search = value),
                    decoration: const InputDecoration(
                      hintText: 'Search student or class...',
                      prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilterChipButton(
                        label: _class ?? 'All Classes',
                        active: _class != null,
                        onTap: () => _pick<String?>(
                          'Class',
                          [(label: 'All Classes', value: null), for (final name in classes) (label: name, value: name)],
                          _class,
                          (value) => _class = value,
                        ),
                      ),
                      FilterChipButton(
                        label: _statuses.where((item) => item.$1 == _status).firstOrNull?.$2 ?? 'All Fee Statuses',
                        active: _status != null,
                        onTap: () => _pick<String?>(
                          'Fee status',
                          [
                            (label: 'All Fee Statuses', value: null),
                            for (final (value, label) in _statuses) (label: label, value: value),
                          ],
                          _status,
                          (value) => _status = value,
                        ),
                      ),
                      FilterChipButton(
                        label: _dueAge?.label ?? 'All Due Ages',
                        active: _dueAge != null,
                        onTap: () => _pick<DueAge?>(
                          'Due age',
                          [(label: 'All Due Ages', value: null), for (final age in DueAge.values) (label: age.label, value: age)],
                          _dueAge,
                          (value) => _dueAge = value,
                        ),
                      ),
                      FilterChipButton(
                        label: _sort.label,
                        active: _sort != DefaulterSort.overdueDesc,
                        onTap: () => _pick<DefaulterSort>(
                          'Sort',
                          [for (final sort in DefaulterSort.values) (label: sort.label, value: sort)],
                          _sort,
                          (value) => _sort = value,
                        ),
                      ),
                      if (_hasFilters)
                        TextButton(
                          onPressed: () => setState(() {
                            _searchController.clear();
                            _search = '';
                            _class = null;
                            _status = null;
                            _dueAge = null;
                            _sort = DefaulterSort.overdueDesc;
                          }),
                          child: const Text('Clear'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Showing ${visible.length} of ${rows.length} pending active fee accounts.',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
              empty: const AppCard(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: EmptyView(icon: Icons.task_alt_rounded, title: 'No defaulters match the selected filters.'),
              ),
              itemCount: visible.length,
              itemBuilder: (context, index) {
                final row = visible[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _DefaulterCard(
                    row: row,
                    sending: _sendingId == row.studentId,
                    onOpen: () async {
                      final changed = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => StudentFeeLedgerScreen(studentId: row.studentId)),
                      );
                      if (changed == true && mounted) await _reload();
                    },
                    onRemind: () => _sendReminder(row),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _DefaulterCard extends StatelessWidget {
  const _DefaulterCard({required this.row, required this.sending, required this.onOpen, required this.onRemind});

  final DefaulterRow row;
  final bool sending;
  final VoidCallback onOpen;
  final VoidCallback onRemind;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onOpen,
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
                    Text(row.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(
                      [row.className, if (row.feeStructure != null) row.feeStructure!].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              row.status == 'PARTIAL'
                  ? StatusChip(label: row.status, color: AppColors.warning, tint: AppColors.warningSoft)
                  : StatusChip(label: row.status, color: AppColors.danger, tint: AppColors.dangerSoft),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: MoneyFigure(label: 'Balance', value: formatInr(row.balance))),
              row.daysOverdue > 0
                  ? StatusChip(label: '${row.daysOverdue} days', color: AppColors.danger, tint: AppColors.dangerSoft)
                  : StatusChip(label: '${row.daysOverdue} days', color: AppColors.warning, tint: AppColors.warningSoft),
            ],
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: sending ? null : onRemind,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(40)),
            child: Text(sending ? 'Sending…' : 'Send WhatsApp'),
          ),
        ],
      ),
    );
  }
}
