import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/list_with_header.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/teacher_models.dart';
import '../leave/leave_approval_screen.dart';
import '../widgets/management_widgets.dart';
import 'add_teacher_screen.dart';
import 'teacher_attendance_screen.dart';
import 'teacher_profile_screen.dart';

/// Teacher Management. Loads the whole active or inactive list, as the web
/// Teachers page does, and filters it locally by search, subject and class
/// teacher — the web's filters. Rows are shown 20 at a time.
class TeacherManagementScreen extends StatefulWidget {
  const TeacherManagementScreen({super.key});

  @override
  State<TeacherManagementScreen> createState() => _TeacherManagementScreenState();
}

class _TeacherManagementScreenState extends State<TeacherManagementScreen> {
  static const _pageSize = 20;

  TeacherCounts? _counts;
  List<TeacherRow> _all = const [];

  String _search = '';
  String? _subject;
  String? _classTeacher;
  bool _inactive = false;
  int _shown = _pageSize;

  bool _loading = true;
  bool _exporting = false;
  String? _error;

  /// Bumped on every reload so a slow response for the other tab is dropped.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _loadCounts();
    _reload();
  }

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  Future<void> _loadCounts() async {
    try {
      final counts = await _repository.teacherCounts();
      if (mounted) setState(() => _counts = counts);
    } on ApiException {
      // The tiles are extras; the list reports its own errors.
    }
  }

  Future<void> _reload() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _repository.teachers(inactive: _inactive);
      if (!mounted || generation != _generation) return;
      setState(() {
        _all = rows;
        _shown = _pageSize;
        // A filter value that no longer exists in this list would hide everything.
        if (_subject != null && !_subjectOptions.contains(_subject)) _subject = null;
        if (_classTeacher != null && !_classTeacherOptions.contains(_classTeacher)) _classTeacher = null;
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

  Future<void> _refresh() => Future.wait([_loadCounts(), _reload()]);

  List<String> get _subjectOptions => ({for (final teacher in _all) ...teacher.subjects}.toList()..sort());

  List<String> get _classTeacherOptions =>
      ({for (final teacher in _all) ...teacher.classTeacherLabels}.toList()..sort());

  List<TeacherRow> get _filtered => _all
      .where((teacher) =>
          teacher.matches(_search) &&
          (_subject == null || teacher.subjects.contains(_subject)) &&
          (_classTeacher == null || teacher.classTeacherLabels.contains(_classTeacher)))
      .toList();

  void _setFilter(VoidCallback change) => setState(() {
        change();
        _shown = _pageSize;
      });

  Future<void> _pickSubject() async {
    final picked = await pickFromSheet<String?>(
      context,
      title: 'Subject',
      options: [
        (label: 'All Subjects', value: null),
        for (final subject in _subjectOptions) (label: subject, value: subject),
      ],
      selected: _subject,
    );
    if (picked != null) _setFilter(() => _subject = picked.value);
  }

  Future<void> _pickClassTeacher() async {
    final picked = await pickFromSheet<String?>(
      context,
      title: 'Class teacher of',
      options: [
        (label: 'All Class Teachers', value: null),
        for (final label in _classTeacherOptions) (label: 'Class $label', value: label),
      ],
      selected: _classTeacher,
    );
    if (picked != null) _setFilter(() => _classTeacher = picked.value);
  }

  Future<void> _openTeacher(TeacherRow row) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TeacherProfileScreen(teacherId: row.id)),
    );
    if (changed == true && mounted) await _refresh();
  }

  Future<void> _addTeacher() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddTeacherScreen()),
    );
    if (created == true && mounted) {
      _toast('Teacher added.');
      await _refresh();
    }
  }

  Future<void> _export() async {
    final rows = _filtered;
    if (rows.isEmpty) {
      _toast('No teachers match these filters.', isError: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/teachers-${DateFormat('yyyy-MM-dd').format(DateTime.now())}.csv');
      await file.writeAsString(teachersCsv(rows));
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'text/csv')],
          subject: 'Teachers export',
          text: '${rows.length} teachers',
        ),
      );
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

  @override
  Widget build(BuildContext context) {
    final counts = _counts;
    final filtered = _filtered;
    final visible = filtered.take(_shown).toList();
    final showRows = !_loading && _error == null && filtered.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Teacher Management')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListWithHeader(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          header: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ResponsiveGrid(
                phoneColumns: 3,
                wideColumns: 3,
                children: [
                  KpiCard(index: 1, label: 'Total', value: counts == null ? '—' : '${counts.total}', icon: Icons.badge_rounded),
                  KpiCard(index: 3, label: 'Active', value: counts == null ? '—' : '${counts.active}', icon: Icons.how_to_reg_rounded),
                  KpiCard(index: 2, label: 'Inactive', value: counts == null ? '—' : '${counts.inactive}', icon: Icons.person_off_rounded),
                ],
              ),
              const SizedBox(height: 16),
              ResponsiveGrid(
                phoneColumns: 2,
                wideColumns: 3,
                children: [
                  ManagementActionButton(
                    icon: Icons.person_add_alt_1_rounded,
                    label: 'Add Teacher',
                    primary: true,
                    onTap: _addTeacher,
                  ),
                  ManagementActionButton(
                    icon: Icons.ios_share_rounded,
                    label: _exporting ? 'Exporting…' : 'Export List',
                    onTap: _exporting || _loading ? null : _export,
                  ),
                  ManagementActionButton(
                    icon: Icons.how_to_reg_rounded,
                    label: 'Teacher Attendance',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const TeacherAttendanceScreen()),
                    ),
                  ),
                  ManagementActionButton(
                    icon: Icons.event_available_rounded,
                    label: 'Teacher Leave',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const LeaveApprovalScreen()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                onChanged: (value) => _setFilter(() => _search = value),
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  hintText: 'Search by name, phone or email',
                  prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilterChipButton(
                    label: _subject ?? 'All Subjects',
                    active: _subject != null,
                    onTap: _pickSubject,
                  ),
                  FilterChipButton(
                    label: _classTeacher == null ? 'All Class Teachers' : 'Class $_classTeacher',
                    active: _classTeacher != null,
                    onTap: _pickClassTeacher,
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
              else if (filtered.isEmpty)
                const AppCard(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: EmptyView(
                    icon: Icons.person_search_rounded,
                    title: 'No teachers found',
                    message: 'Try a different search or filter.',
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Showing ${visible.length} of ${filtered.length}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
            ],
          ),
          itemCount: showRows ? visible.length : 0,
          itemBuilder: (context, index) => Padding(
            padding: EdgeInsets.only(top: index == 0 ? 0 : 8),
            child: TeacherRowCard(teacher: visible[index], onTap: () => _openTeacher(visible[index])),
          ),
          footer: showRows && visible.length < filtered.length
              ? Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: OutlinedButton(
                    onPressed: () => setState(() => _shown += _pageSize),
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                    child: const Text('Load More'),
                  ),
                )
              : null,
        ),
      ),
    );
  }
}

/// The web's status pill tones: green active, amber otherwise.
StatusChip teacherStatusChip(TeacherRow teacher) => teacher.isActive
    ? const StatusChip(label: 'Active', color: AppColors.success, tint: AppColors.successSoft)
    : const StatusChip(label: 'Inactive', color: AppColors.warning, tint: AppColors.warningSoft);

class TeacherRowCard extends StatelessWidget {
  const TeacherRowCard({super.key, required this.teacher, this.onTap});

  final TeacherRow teacher;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final subjects = teacher.subjects;
    final details = [
      subjects.isEmpty ? 'No subjects assigned' : subjects.join(', '),
      if (teacher.classTeacherFor.isNotEmpty) 'Class teacher ${teacher.classTeacherLabel}',
      '${teacher.assignedPeriods}/${teacher.totalSlots} periods',
    ].join(' · ');

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.successSoft,
            child: Text(
              teacher.fullName.isEmpty ? '?' : teacher.fullName.characters.first.toUpperCase(),
              style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  teacher.fullName,
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
          teacherStatusChip(teacher),
        ],
      ),
    );
  }
}
