import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/student_models.dart';
import '../widgets/management_widgets.dart';
import 'add_student_screen.dart';
import 'student_export.dart';
import 'student_profile_screen.dart';

/// Student Management. Lists what the web Students page lists — search, class
/// and fee-status filters, active or inactive, paged — with the blueprint's
/// stat tiles and quick actions on top.
class StudentManagementScreen extends StatefulWidget {
  const StudentManagementScreen({super.key});

  @override
  State<StudentManagementScreen> createState() => _StudentManagementScreenState();
}

class _StudentManagementScreenState extends State<StudentManagementScreen> {
  static const _pageSize = 20;

  final _searchController = TextEditingController();
  Timer? _searchDebounce;

  List<ClassChoice> _classes = const [];
  StudentCounts? _counts;

  String _search = '';
  ClassChoice? _class;
  FeeStatus? _feeStatus;
  bool _inactive = false;

  final List<StudentRow> _rows = [];

  /// Rows the server has sent, before the web's per-page fee-status filter;
  /// paging is counted on these, not on the rows shown.
  int _fetched = 0;
  int _total = 0;
  int _page = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _exporting = false;
  String? _error;

  /// Bumped on every new query so a slow response for an old filter is dropped.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _loadHeader();
    _reload();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  Future<void> _loadHeader() async {
    try {
      final results = await Future.wait([_repository.studentCounts(), _repository.classes()]);
      if (!mounted) return;
      setState(() {
        _counts = results[0] as StudentCounts;
        _classes = results[1] as List<ClassChoice>;
      });
    } on ApiException {
      // The tiles and class filter are extras; the list reports its own errors.
    }
  }

  Future<void> _reload() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final page = await _repository.students(
        page: 1,
        limit: _pageSize,
        search: _search,
        classId: _class?.id,
        feeStatus: _feeStatus,
        inactive: _inactive,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _rows
          ..clear()
          ..addAll(matchingFeeStatus(page.items, _feeStatus));
        _fetched = page.items.length;
        _total = page.total;
        _page = 1;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    final generation = _generation;
    setState(() => _loadingMore = true);
    try {
      final page = await _repository.students(
        page: _page + 1,
        limit: _pageSize,
        search: _search,
        classId: _class?.id,
        feeStatus: _feeStatus,
        inactive: _inactive,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _rows.addAll(matchingFeeStatus(page.items, _feeStatus));
        _fetched += page.items.length;
        _total = page.total;
        _page++;
      });
    } on ApiException catch (error) {
      _toast(error.message, isError: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _refresh() async {
    await Future.wait([_loadHeader(), _reload()]);
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      if (value.trim() == _search) return;
      _search = value.trim();
      _reload();
    });
  }

  Future<void> _openStudent(StudentRow row) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PrincipalStudentProfileScreen(studentId: row.id)),
    );
    if (changed == true && mounted) await _refresh();
  }

  Future<void> _addStudent() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddStudentScreen()),
    );
    if (created == true && mounted) {
      _toast('Student added.');
      await _refresh();
    }
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final rows = await _repository.allStudents(
        search: _search,
        classId: _class?.id,
        feeStatus: _feeStatus,
        inactive: _inactive,
      );
      if (rows.isEmpty) {
        _toast('No students match these filters.', isError: true);
        return;
      }
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/students-${DateFormat('yyyy-MM-dd').format(DateTime.now())}.csv');
      await file.writeAsString(studentsCsv(rows));
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'text/csv')],
          subject: 'Students export',
          text: '${rows.length} students',
        ),
      );
    } on ApiException catch (error) {
      _toast(error.message, isError: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _toast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.success,
      ));
  }

  Future<void> _pickClass() async {
    final picked = await pickFromSheet<ClassChoice?>(
      context,
      title: 'Class',
      options: [
        (label: 'All Classes', value: null),
        for (final item in _classes) (label: item.label, value: item),
      ],
      selected: _class,
    );
    if (picked == null || picked.value?.id == _class?.id) return;
    setState(() => _class = picked.value);
    _reload();
  }

  Future<void> _pickFeeStatus() async {
    final picked = await pickFromSheet<FeeStatus?>(
      context,
      title: 'Fee status',
      options: [
        (label: 'All Fee Statuses', value: null),
        (label: 'Paid Fees', value: FeeStatus.paid),
        (label: 'Pending Fees', value: FeeStatus.pending),
        (label: 'Overdue Fees', value: FeeStatus.overdue),
      ],
      selected: _feeStatus,
    );
    if (picked == null || picked.value == _feeStatus) return;
    setState(() => _feeStatus = picked.value);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final counts = _counts;
    final hasMore = _fetched < _total;

    return Scaffold(
      appBar: AppBar(title: const Text('Student Management')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            ResponsiveGrid(
              phoneColumns: 3,
              wideColumns: 3,
              children: [
                KpiCard(index: 1, label: 'Total', value: counts == null ? '—' : '${counts.total}', icon: Icons.groups_rounded),
                KpiCard(index: 3, label: 'Active', value: counts == null ? '—' : '${counts.active}', icon: Icons.how_to_reg_rounded),
                KpiCard(index: 2, label: 'Inactive', value: counts == null ? '—' : '${counts.inactive}', icon: Icons.person_off_rounded),
              ],
            ),
            const SizedBox(height: 16),
            ResponsiveGrid(
              phoneColumns: 2,
              wideColumns: 2,
              children: [
                ManagementActionButton(
                  icon: Icons.person_add_alt_1_rounded,
                  label: 'Add Student',
                  primary: true,
                  onTap: _addStudent,
                ),
                ManagementActionButton(
                  icon: Icons.ios_share_rounded,
                  label: _exporting ? 'Exporting…' : 'Export List',
                  onTap: _exporting ? null : _export,
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(
                hintText: 'Search by name, admission no or phone',
                prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilterChipButton(
                  label: _class?.label ?? 'All Classes',
                  active: _class != null,
                  onTap: _pickClass,
                ),
                FilterChipButton(
                  label: switch (_feeStatus) {
                    null => 'All Fee Statuses',
                    final status => '${status.label} Fees',
                  },
                  active: _feeStatus != null,
                  onTap: _pickFeeStatus,
                ),
              ],
            ),
            const SizedBox(height: 12),
            SegmentedTabs(
              labels: const ['Active', 'Inactive'],
              counts: counts == null ? null : [counts.active, counts.inactive],
              index: _inactive ? 1 : 0,
              onChanged: (index) {
                if ((index == 1) == _inactive) return;
                setState(() => _inactive = index == 1);
                _reload();
              },
            ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: LoadingView())
            else if (_error != null)
              ErrorView(message: _error!, onRetry: _reload)
            else if (_rows.isEmpty && !hasMore)
              const AppCard(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: EmptyView(
                  icon: Icons.person_search_rounded,
                  title: 'No students found',
                  message: 'Try a different search or filter.',
                ),
              )
            else ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _feeStatus == null
                      ? 'Showing ${_rows.length} of $_total'
                      : 'Showing ${_rows.length} with ${_feeStatus!.label.toLowerCase()} fees',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
              for (var index = 0; index < _rows.length; index++) ...[
                if (index > 0) const SizedBox(height: 8),
                StudentRowCard(student: _rows[index], onTap: () => _openStudent(_rows[index])),
              ],
              if (hasMore) ...[
                const SizedBox(height: 14),
                OutlinedButton(
                  onPressed: _loadingMore ? null : _loadMore,
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                  child: Text(_loadingMore ? 'Loading…' : 'Load More'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/// The web's fee status tones: green paid, amber pending, red overdue.
StatusChip feeStatusChip(FeeStatus status) => switch (status) {
      FeeStatus.paid => const StatusChip(label: 'Paid', color: AppColors.success, tint: AppColors.successSoft),
      FeeStatus.pending => const StatusChip(label: 'Pending', color: AppColors.warning, tint: AppColors.warningSoft),
      FeeStatus.overdue => const StatusChip(label: 'Overdue', color: AppColors.danger, tint: AppColors.dangerSoft),
    };

class StudentRowCard extends StatelessWidget {
  const StudentRowCard({super.key, required this.student, this.onTap});

  final StudentRow student;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final status = student.feeStatus;
    final attendance = student.attendancePercentage;
    final details = [
      'Class ${student.className}',
      student.admissionNumber,
      if (attendance != null) '$attendance% attendance',
    ].where((part) => part.isNotEmpty).join(' · ');

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              student.fullName.isEmpty ? '?' : student.fullName.characters.first.toUpperCase(),
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  details,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (status != null) feeStatusChip(status),
              if ((student.pendingAmount ?? 0) > 0) ...[
                const SizedBox(height: 4),
                Text(
                  formatInr(student.pendingAmount!, compact: false),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
