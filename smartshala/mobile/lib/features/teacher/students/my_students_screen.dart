import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_models.dart';
import '../data/teacher_repository.dart';
import '../widgets/picker_field.dart';
import 'student_profile_screen.dart';

class MyStudentsScreen extends StatefulWidget {
  const MyStudentsScreen({super.key});

  @override
  State<MyStudentsScreen> createState() => _MyStudentsScreenState();
}

class _MyStudentsScreenState extends State<MyStudentsScreen> {
  List<ClassOption> _classes = const [];
  ClassOption? _selectedClass;
  List<StudentListItem> _students = const [];
  String _search = '';
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
      await _loadStudents();
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

  List<StudentListItem> get _visible {
    final query = _search.trim().toLowerCase();
    if (query.isEmpty) return _students;
    return _students
        .where((student) =>
            student.fullName.toLowerCase().contains(query) ||
            student.admissionNumber.toLowerCase().contains(query) ||
            (student.rollNumber?.toString() ?? '').contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Students')),
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
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Column(
                            children: [
                              PickerField<ClassOption>(
                                label: 'Class',
                                value: _selectedClass,
                                items: _classes,
                                labelOf: (item) => item.label,
                                idOf: (item) => item.id,
                                onChanged: (item) {
                                  setState(() => _selectedClass = item);
                                  _loadStudents();
                                },
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                onChanged: (value) => setState(() => _search = value),
                                decoration: const InputDecoration(
                                  hintText: 'Search students',
                                  prefixIcon: Icon(Icons.search_rounded,
                                      size: 20, color: AppColors.textMuted),
                                  contentPadding:
                                      EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                ),
                              ),
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
                                      separatorBuilder: (_, __) => const SizedBox(height: 8),
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

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.student, required this.onTap});

  final StudentListItem student;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final attendance = student.attendancePercentage;
    final color = attendance == null
        ? AppColors.textMuted
        : attendance >= 85
            ? AppColors.success
            : attendance >= 75
                ? AppColors.warning
                : AppColors.danger;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          CircleAvatar(
            radius: 19,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              student.rollNumber?.toString() ?? student.fullName.characters.first.toUpperCase(),
              style: const TextStyle(
                fontSize: 12.5,
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
                const SizedBox(height: 2),
                Text(
                  student.rollNumber == null
                      ? student.admissionNumber
                      : 'Roll No. ${student.rollNumber}',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          if (attendance != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${attendance.round()}%',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: color),
              ),
            ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}
