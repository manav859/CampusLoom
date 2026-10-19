import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_back_button.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/pick_sheet.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_models.dart';
import '../data/teacher_repository.dart';
import 'student_profile_screen.dart';

/// How the roll is ordered. Roll number is the register's own order, which is
/// how a teacher reads a class; the other two answer a question about it.
enum StudentSort { rollNumber, name, attendance }

extension on StudentSort {
  String get label => switch (this) {
        StudentSort.rollNumber => 'Roll number',
        StudentSort.name => 'Name (A–Z)',
        StudentSort.attendance => 'Attendance (lowest first)',
      };
}

class MyStudentsScreen extends StatefulWidget {
  const MyStudentsScreen({super.key});

  @override
  State<MyStudentsScreen> createState() => _MyStudentsScreenState();
}

class _MyStudentsScreenState extends State<MyStudentsScreen> {
  List<ClassOption> _classes = const [];
  ClassOption? _selectedClass;
  List<StudentListItem> _students = const [];

  /// Today's attendance for every class this teacher takes, so the tiles can
  /// show the selected one without a request of their own.
  List<ClassAttendance> _attendanceToday = const [];

  String _search = '';
  StudentSort _sort = StudentSort.rollNumber;
  bool _loadingClasses = true;
  bool _loadingStudents = false;
  String? _error;

  TeacherRepository get _repository => context.read<TeacherRepository>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loadingClasses = true;
      _error = null;
    });

    try {
      final classes = await _repository.myClasses();
      if (!mounted) return;
      setState(() {
        _classes = classes;
        _selectedClass = classes.firstOrNull;
        _loadingClasses = false;
      });
      await Future.wait([_loadStudents(), _loadAttendance()]);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingClasses = false;
      });
    }
  }

  Future<void> _loadStudents() async {
    setState(() => _loadingStudents = true);
    try {
      final students = await _repository.students(classId: _selectedClass?.id);
      if (!mounted) return;
      setState(() {
        _students = students;
        _loadingStudents = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loadingStudents = false;
      });
    }
  }

  /// The tiles are a summary, not the screen: a dashboard that will not load
  /// leaves them blank rather than failing the roll.
  Future<void> _loadAttendance() async {
    try {
      final dashboard = await _repository.dashboard();
      if (!mounted) return;
      setState(() => _attendanceToday = dashboard.attendance);
    } on ApiException {
      if (mounted) setState(() => _attendanceToday = const []);
    }
  }

  /// Today's figures for the class on screen, or null when the class has no
  /// row yet — which is also how "not marked" arrives.
  ClassAttendance? get _todayForClass {
    final id = _selectedClass?.id;
    if (id == null) return null;
    for (final entry in _attendanceToday) {
      if (entry.classId == id) return entry;
    }
    return null;
  }

  Future<void> _pickClass() async {
    final picked = await pickFromSheet<String?>(
      context,
      title: 'Class',
      selected: _selectedClass?.id,
      options: [
        for (final option in _classes) (label: option.label, value: option.id),
      ],
    );
    if (picked == null || picked.value == _selectedClass?.id) return;

    setState(() {
      _selectedClass = _classes.firstWhere((option) => option.id == picked.value);
    });
    await _loadStudents();
  }

  Future<void> _pickSort() async {
    final picked = await pickFromSheet<StudentSort>(
      context,
      title: 'Sort by',
      selected: _sort,
      options: [
        for (final option in StudentSort.values) (label: option.label, value: option),
      ],
    );
    if (picked != null) setState(() => _sort = picked.value);
  }

  List<StudentListItem> get _visible {
    final query = _search.trim().toLowerCase();
    final matched = query.isEmpty
        ? [..._students]
        : _students
            .where((student) =>
                student.fullName.toLowerCase().contains(query) ||
                student.admissionNumber.toLowerCase().contains(query) ||
                (student.rollNumber?.toString() ?? '').contains(query))
            .toList();

    matched.sort(switch (_sort) {
      // A student with no roll number or no attendance yet sorts last either
      // way, rather than leading the list on a missing value.
      StudentSort.rollNumber => (a, b) {
          final left = a.rollNumber ?? 1 << 30;
          final right = b.rollNumber ?? 1 << 30;
          return left != right ? left.compareTo(right) : a.fullName.compareTo(b.fullName);
        },
      StudentSort.name => (a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()),
      StudentSort.attendance => (a, b) {
          final left = a.attendancePercentage ?? 1e9;
          final right = b.attendancePercentage ?? 1e9;
          return left != right ? left.compareTo(right) : a.fullName.compareTo(b.fullName);
        },
    });
    return matched;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('My Students'),
        actions: [
          IconButton(
            onPressed: _classes.isEmpty ? null : _pickSort,
            tooltip: 'Sort',
            icon: const Icon(Icons.sort_rounded),
          ),
        ],
      ),
      body: _loadingClasses
          ? const LoadingView(message: 'Loading your classes…')
          : _error != null && _students.isEmpty
              ? ErrorView(message: _error!, onRetry: _load)
              : _classes.isEmpty
                  ? const EmptyView(
                      icon: Icons.class_outlined,
                      title: 'No classes assigned',
                      message: 'You are not assigned to any class yet.',
                    )
                  : Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    flex: 9,
                                    child: _ClassPill(
                                      label: _selectedClass?.label ?? 'Class',
                                      onTap: _pickClass,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(flex: 11, child: _SearchField(onChanged: (value) => setState(() => _search = value))),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _TodayTiles(total: _students.length, today: _todayForClass),
                            ],
                          ),
                        ),
                        Expanded(
                          child: _loadingStudents
                              ? const LoadingView()
                              : _visible.isEmpty
                                  ? const EmptyView(
                                      icon: Icons.person_search_rounded,
                                      title: 'No students found',
                                      message: 'Try a different class or search term.',
                                    )
                                  : ListView.separated(
                                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                                      itemCount: _visible.length,
                                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                                      itemBuilder: (context, index) => _StudentRow(
                                        student: _visible[index],
                                        onTap: () => Navigator.of(context).push(
                                          MaterialPageRoute<void>(
                                            builder: (_) =>
                                                StudentProfileScreen(studentId: _visible[index].id),
                                          ),
                                        ),
                                      ),
                                    ),
                        ),
                      ],
                    ),
    );
  }
}

class _ClassPill extends StatelessWidget {
  const _ClassPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(26);

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: shape, boxShadow: Home.shadow),
      child: Material(
        color: AppColors.surface,
        borderRadius: shape,
        child: InkWell(
          onTap: onTap,
          borderRadius: shape,
          child: Ink(
            decoration: BoxDecoration(borderRadius: shape, border: Border.all(color: Home.line)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 13, 10, 13),
              child: Row(
                children: [
                  const Icon(Icons.groups_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Home.ink,
                      ),
                    ),
                  ),
                  const Icon(Icons.expand_more_rounded, size: 18, color: Home.inkMuted),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(26);

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: shape, boxShadow: Home.shadow),
      child: TextField(
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: const TextStyle(fontSize: 13.5, color: Home.ink),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search students',
          hintStyle: const TextStyle(fontSize: 13.5, color: Home.inkMuted),
          prefixIcon: const Icon(Icons.search_rounded, size: 19, color: Home.inkMuted),
          prefixIconConstraints: const BoxConstraints(minWidth: 38, minHeight: 38),
          contentPadding: const EdgeInsets.fromLTRB(0, 14, 12, 14),
          border: OutlineInputBorder(borderRadius: shape, borderSide: const BorderSide(color: Home.line)),
          enabledBorder:
              OutlineInputBorder(borderRadius: shape, borderSide: const BorderSide(color: Home.line)),
          focusedBorder: OutlineInputBorder(
            borderRadius: shape,
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
        ),
      ),
    );
  }
}

/// The class at a glance today: how many are on the roll, and how that roll
/// was marked. Until someone marks the register there is nothing to show, so
/// the three attendance tiles say so rather than reading zero.
class _TodayTiles extends StatelessWidget {
  const _TodayTiles({required this.total, required this.today});

  final int total;
  final ClassAttendance? today;

  @override
  Widget build(BuildContext context) {
    final marked = today?.marked ?? false;
    String count(int Function(ClassAttendance) of) =>
        marked && today != null ? '${of(today!)}' : '—';

    final tiles = [
      (
        icon: Icons.groups_rounded,
        value: '$total',
        label: 'Total Students',
        color: AppColors.primary,
        ground: const Color(0xFFE7F0FD),
      ),
      (
        icon: Icons.check_circle_outline_rounded,
        value: count((item) => item.present),
        label: 'Present',
        color: Home.green,
        ground: const Color(0xFFE6F6EC),
      ),
      (
        icon: Icons.cancel_outlined,
        value: count((item) => item.absent),
        label: 'Absent',
        color: AppColors.danger,
        ground: const Color(0xFFFDE8E9),
      ),
      (
        icon: Icons.event_busy_rounded,
        value: count((item) => item.leave),
        label: 'On Leave',
        color: AppColors.teal,
        ground: const Color(0xFFE1F3F1),
      ),
    ];

    return Row(
      children: [
        for (final tile in tiles) ...[
          if (tile != tiles.first) const SizedBox(width: 8),
          Expanded(
            child: _Tile(
              icon: tile.icon,
              value: tile.value,
              label: tile.label,
              color: tile.color,
              ground: tile.ground,
            ),
          ),
        ],
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.ground,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final Color ground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(9, 10, 9, 10),
      decoration: BoxDecoration(color: ground, borderRadius: BorderRadius.circular(Home.tileRadius)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Four tiles across a phone leave very little width, so the icon and
          // the figure shrink together rather than either one wrapping.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              children: [
                Icon(icon, size: 17, color: color),
                const SizedBox(width: 5),
                Text(
                  value,
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: color,
                    height: 1.1,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 5),
          SizedBox(
            width: double.infinity,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                label,
                maxLines: 1,
                style: const TextStyle(fontSize: 10.5, color: Home.inkSoft, height: 1.2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.student, required this.onTap});

  final StudentListItem student;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final attendance = student.attendancePercentage;
    final color = attendance == null
        ? Home.inkMuted
        : attendance >= 85
            ? Home.green
            : attendance >= 75
                ? Home.amberInk
                : AppColors.danger;
    final tint = attendance == null
        ? const Color(0xFFF1F4F8)
        : attendance >= 85
            ? Home.greenSoft
            : attendance >= 75
                ? Home.amberSoft
                : AppColors.dangerSoft;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: Home.blueSoft, shape: BoxShape.circle),
            child: Text(
              initialsOf(student.fullName),
              style: const TextStyle(
                fontSize: 13,
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: Home.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  student.rollNumber == null
                      ? student.admissionNumber
                      : 'Roll No. ${student.rollNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: Home.inkSoft),
                ),
              ],
            ),
          ),
          if (attendance != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(20)),
              child: Text(
                '${attendance.round()}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color),
              ),
            ),
          ],
          const Icon(Icons.chevron_right_rounded, color: Home.inkMuted, size: 22),
        ],
      ),
    );
  }
}

/// "Aditya Parikh" -> "AP"; a single name gives one letter. Used in place of a
/// photo, which the roll does not carry.
String initialsOf(String fullName) {
  final words = fullName.trim().split(RegExp(r'\s+')).where((word) => word.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  final letters = words.length == 1
      ? words.first.characters.take(1)
      : [words.first, words.last].map((word) => word.characters.first).join().characters;
  return letters.toString().toUpperCase();
}
