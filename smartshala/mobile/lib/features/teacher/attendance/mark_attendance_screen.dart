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
  const MarkAttendanceScreen({super.key, this.initialClassId});

  /// Opens on this class instead of the first one — Today's Classes sends the
  /// class whose row was tapped. Ignored when the teacher does not have it.
  final String? initialClassId;

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
      final classes = await _repository.myClasses(classTeacherOnly: true);
      if (!mounted) return;
      setState(() {
        _classes = classes;
        _selectedClass = classes.isEmpty
            ? null
            : classes.firstWhere(
                (option) => option.id == widget.initialClassId,
                orElse: () => classes.first,
              );
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
                      title: 'No classes to mark',
                      message: 'Attendance is marked by the class teacher, and '
                          'you are not class teacher of any class. Taking '
                          'periods in a class does not include its attendance.',
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
              label: 'Total',
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
          const SizedBox(width: 10),
          Expanded(
            child: _Counter(
              value: roster.leaveCount,
              label: 'On Leave',
              color: AppColors.teal,
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

        return AppCard(
          padding: const EdgeInsets.fromLTRB(12, 8, 10, 8),
          child: Row(
            children: [
              CircleAvatar(
                radius: 17,
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
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _SlidingText(
                      text: student.fullName,
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
              const SizedBox(width: 10),
              _MarkSegments(
                studentId: student.id,
                studentName: student.fullName,
                mark: student.mark,
                enabled: canEdit,
                onChanged: (mark) => onChanged(student, mark),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// A name too long for its column slides rather than widening it, so the marks
/// stay in the same place down the whole list and a long name is still read in
/// full. It dwells at each end: a name that never stops moving cannot be read.
class _SlidingText extends StatefulWidget {
  const _SlidingText({required this.text, required this.style});

  final String text;
  final TextStyle style;

  @override
  State<_SlidingText> createState() => _SlidingTextState();
}

class _SlidingTextState extends State<_SlidingText> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);
  double _overflow = -1;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _sync(double overflow) {
    if (overflow == _overflow) return;
    _overflow = overflow;
    _controller.stop();
    _controller.reset();
    if (overflow <= 0) return;
    // Roughly 33 logical pixels a second, plus the dwell at either end.
    _controller.duration = Duration(milliseconds: 2600 + (overflow * 30).round());
    _controller.repeat();
  }

  /// Where the text sits at [t] of one loop: still, out, still, back.
  static double _offsetFor(double t, double overflow) {
    const outStart = 0.18;
    const outEnd = 0.46;
    const backStart = 0.66;
    if (t < outStart) return 0;
    if (t < outEnd) {
      return -overflow * Curves.easeInOut.transform((t - outStart) / (outEnd - outStart));
    }
    if (t < backStart) return -overflow;
    return -overflow * (1 - Curves.easeInOut.transform((t - backStart) / (1 - backStart)));
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final plain = Text(
          widget.text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: widget.style,
        );
        if (!constraints.hasBoundedWidth) return plain;

        final painter = TextPainter(
          text: TextSpan(text: widget.text, style: widget.style),
          maxLines: 1,
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
        )..layout();
        final overflow = painter.width - constraints.maxWidth;

        // Someone who has asked for less motion gets the name cut off instead.
        final stillness = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _sync(stillness ? 0 : overflow);
        });
        if (stillness || overflow <= 0) return plain;

        return ClipRect(
          child: SizedBox(
            height: painter.height,
            width: constraints.maxWidth,
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) => Transform.translate(
                offset: Offset(_offsetFor(_controller.value, overflow), 0),
                child: OverflowBox(
                  alignment: Alignment.centerLeft,
                  maxWidth: painter.width,
                  child: Text(
                    widget.text,
                    maxLines: 1,
                    softWrap: false,
                    style: widget.style,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Present, Absent or Leave for one student, as a single control rather than
/// three loose buttons. Leave is an excused absence — the family said so — and
/// counts for nothing, exactly like Absent; it is here so the register records
/// why a seat was empty.
///
/// The track is the same width whatever the name beside it is, which is what
/// keeps the marks aligned down the list.
class _MarkSegments extends StatelessWidget {
  const _MarkSegments({
    required this.studentId,
    required this.studentName,
    required this.mark,
    required this.enabled,
    required this.onChanged,
  });

  final String studentId;
  final String studentName;
  final AttendanceMark mark;
  final bool enabled;
  final ValueChanged<AttendanceMark> onChanged;

  static const _options = [
    (mark: AttendanceMark.present, letter: 'P', label: 'Present', color: AppColors.success),
    (mark: AttendanceMark.absent, letter: 'A', label: 'Absent', color: AppColors.danger),
    (mark: AttendanceMark.leave, letter: 'L', label: 'Leave', color: AppColors.teal),
  ];

  static const _segment = 34.0;
  static const _height = 30.0;
  static const _inset = 3.0;
  static const _hairline = 1.0;

  @override
  Widget build(BuildContext context) {
    final found = _options.indexWhere((option) => option.mark == mark);
    final index = found < 0 ? 0 : found;
    final selected = _options[index];

    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Container(
        // The border draws inside the box, so it comes out of the width too.
        width: _segment * 3 + (_inset + _hairline) * 2,
        padding: const EdgeInsets.all(_inset),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border, width: _hairline),
        ),
        child: Stack(
          children: [
            AnimatedAlign(
              alignment: Alignment(-1 + index.toDouble(), 0),
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              child: Container(
                width: _segment,
                height: _height,
                decoration: BoxDecoration(
                  color: selected.color,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            Row(
              children: [
                for (final option in _options)
                  Semantics(
                    button: true,
                    selected: option.mark == selected.mark,
                    label: '${option.label} — $studentName',
                    child: InkWell(
                      key: Key('mark-$studentId-${option.mark.name}'),
                      onTap: enabled ? () => onChanged(option.mark) : null,
                      borderRadius: BorderRadius.circular(8),
                      child: SizedBox(
                        width: _segment,
                        height: _height,
                        child: Center(
                          child: Text(
                            option.letter,
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: option.mark == selected.mark
                                  ? Colors.white
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
