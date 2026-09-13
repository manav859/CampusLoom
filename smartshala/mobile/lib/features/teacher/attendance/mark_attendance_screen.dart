import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/teacher_models.dart';
import '../data/teacher_repository.dart';

class MarkAttendanceScreen extends StatefulWidget {
  const MarkAttendanceScreen({super.key});

  @override
  State<MarkAttendanceScreen> createState() => _MarkAttendanceScreenState();
}

class _MarkAttendanceScreenState extends State<MarkAttendanceScreen> {
  List<ClassOption> _classes = const [];
  ClassOption? _selectedClass;
  DateTime _date = DateTime.now();

  AttendanceRoster? _roster;
  String? _error;
  bool _loadingClasses = true;
  bool _loadingRoster = false;
  bool _saving = false;
  bool _showAbsentOnly = false;
  String _search = '';

  TeacherRepository get _repository => context.read<TeacherRepository>();

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loadingClasses = true;
      _error = null;
    });

    try {
      final classes = await _repository.myClasses();
      if (!mounted) return;
      setState(() {
        _classes = classes;
        _selectedClass = classes.isNotEmpty ? classes.first : null;
        _loadingClasses = false;
      });
      if (_selectedClass != null) await _loadRoster();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingClasses = false;
      });
    }
  }

  Future<void> _loadRoster() async {
    final selected = _selectedClass;
    if (selected == null) return;

    setState(() {
      _loadingRoster = true;
      _error = null;
    });

    try {
      final roster = await _repository.roster(classId: selected.id, date: _date);
      if (!mounted) return;
      setState(() {
        _roster = roster;
        _loadingRoster = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _roster = null;
        _loadingRoster = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 60)),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _date = picked);
    await _loadRoster();
  }

  Future<void> _save() async {
    final roster = _roster;
    final selected = _selectedClass;
    if (roster == null || selected == null || _saving) return;

    setState(() => _saving = true);
    try {
      await _repository.markAttendance(
        classId: selected.id,
        date: _date,
        students: roster.students,
      );
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            content: Text(
              'Attendance saved for ${selected.label} — '
              '${roster.presentCount} present, ${roster.absentCount} absent.',
            ),
          ),
        );
      Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)),
        );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<RosterStudent> get _visibleStudents {
    final students = _roster?.students ?? const <RosterStudent>[];
    final query = _search.trim().toLowerCase();

    return students.where((student) {
      if (_showAbsentOnly && student.mark != AttendanceMark.absent) return false;
      if (query.isEmpty) return true;
      return student.fullName.toLowerCase().contains(query) ||
          (student.rollNumber?.toString() ?? '').contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final roster = _roster;
    final canEdit = roster?.canEdit ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Mark Attendance')),
      body: _loadingClasses
          ? const LoadingView(message: 'Loading your classes…')
          : _error != null && roster == null
              ? ErrorView(message: _error!, onRetry: _loadClasses)
              : _classes.isEmpty
                  ? const EmptyView(
                      icon: Icons.class_outlined,
                      title: 'No classes assigned',
                      message: 'You are not assigned to any class yet. '
                          'Ask your principal to add you to a class.',
                    )
                  : Column(
                      children: [
                        _Filters(
                          classes: _classes,
                          selected: _selectedClass,
                          date: _date,
                          onClassChanged: (option) async {
                            setState(() => _selectedClass = option);
                            await _loadRoster();
                          },
                          onPickDate: _pickDate,
                        ),
                        if (roster != null) ...[
                          _CountersRow(roster: roster),
                          if (roster.isHoliday)
                            _HolidayBanner(reason: roster.holidayReason ?? 'Holiday'),
                          _ListControls(
                            absentCount: roster.absentCount,
                            showAbsentOnly: _showAbsentOnly,
                            onToggle: (value) => setState(() => _showAbsentOnly = value),
                            onSearch: (value) => setState(() => _search = value),
                          ),
                        ],
                        Expanded(
                          child: _loadingRoster
                              ? const LoadingView()
                              : roster == null
                                  ? const SizedBox.shrink()
                                  : _StudentList(
                                      students: _visibleStudents,
                                      canEdit: canEdit,
                                      onChanged: (student, mark) =>
                                          setState(() => student.mark = mark),
                                    ),
                        ),
                      ],
                    ),
      bottomNavigationBar: roster == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: FilledButton(
                onPressed: canEdit && !_saving ? _save : null,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                      )
                    : Text(
                        canEdit
                            ? (roster.alreadySubmitted ? 'Update Attendance' : 'Save Attendance')
                            : 'Attendance locked',
                      ),
              ),
            ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.classes,
    required this.selected,
    required this.date,
    required this.onClassChanged,
    required this.onPickDate,
  });

  final List<ClassOption> classes;
  final ClassOption? selected;
  final DateTime date;
  final ValueChanged<ClassOption> onClassChanged;
  final VoidCallback onPickDate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: DropdownButtonFormField<String>(
              initialValue: selected?.id,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Class',
                contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              items: classes
                  .map(
                    (option) => DropdownMenuItem(
                      value: option.id,
                      child: Text(option.label, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                final match = classes.where((option) => option.id == value).firstOrNull;
                if (match != null) onClassChanged(match);
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: InkWell(
              onTap: onPickDate,
              borderRadius: BorderRadius.circular(14),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Date',
                  contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        DateFormat('d MMM yyyy').format(date),
                        style: const TextStyle(fontSize: 13.5),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const Icon(Icons.calendar_today_rounded,
                        size: 15, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CountersRow extends StatelessWidget {
  const _CountersRow({required this.roster});

  final AttendanceRoster roster;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          Expanded(
            child: _Counter(
              value: roster.students.length,
              label: 'Total Students',
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _Counter(
              value: roster.presentCount,
              label: 'Present',
              color: AppColors.success,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _Counter(
              value: roster.absentCount,
              label: 'Absent',
              color: AppColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({required this.value, required this.label, required this.color});

  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _HolidayBanner extends StatelessWidget {
  const _HolidayBanner({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.beach_access_rounded, color: AppColors.warning, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$reason — attendance cannot be marked for this date.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _ListControls extends StatelessWidget {
  const _ListControls({
    required this.absentCount,
    required this.showAbsentOnly,
    required this.onToggle,
    required this.onSearch,
  });

  final int absentCount;
  final bool showAbsentOnly;
  final ValueChanged<bool> onToggle;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        children: [
          Row(
            children: [
              _Tab(
                label: 'Student List',
                selected: !showAbsentOnly,
                onTap: () => onToggle(false),
              ),
              const SizedBox(width: 8),
              _Tab(
                label: 'Absent ($absentCount)',
                selected: showAbsentOnly,
                onTap: () => onToggle(true),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            onChanged: onSearch,
            decoration: const InputDecoration(
              hintText: 'Search student',
              prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _StudentList extends StatelessWidget {
  const _StudentList({
    required this.students,
    required this.canEdit,
    required this.onChanged,
  });

  final List<RosterStudent> students;
  final bool canEdit;
  final void Function(RosterStudent student, AttendanceMark mark) onChanged;

  @override
  Widget build(BuildContext context) {
    if (students.isEmpty) {
      return const EmptyView(
        icon: Icons.person_search_rounded,
        title: 'No students to show',
        message: 'Try clearing the search or switching tabs.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      itemCount: students.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final student = students[index];
        final isAbsent = student.mark == AttendanceMark.absent;

        return AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  student.rollNumber?.toString() ?? '${index + 1}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      student.fullName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (student.rollNumber != null)
                      Text(
                        'Roll No. ${student.rollNumber}',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
              _MarkToggle(
                isAbsent: isAbsent,
                enabled: canEdit,
                onChanged: (absent) => onChanged(
                  student,
                  absent ? AttendanceMark.absent : AttendanceMark.present,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MarkToggle extends StatelessWidget {
  const _MarkToggle({
    required this.isAbsent,
    required this.enabled,
    required this.onChanged,
  });

  final bool isAbsent;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Pill(
          label: 'Present',
          selected: !isAbsent,
          color: AppColors.success,
          onTap: enabled ? () => onChanged(false) : null,
        ),
        const SizedBox(width: 6),
        _Pill(
          label: 'Absent',
          selected: isAbsent,
          color: AppColors.danger,
          onTap: enabled ? () => onChanged(true) : null,
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? color : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
