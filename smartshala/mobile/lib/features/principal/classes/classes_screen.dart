import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';
import 'class_detail_screen.dart';
import 'class_form_screen.dart';

/// Classes & Sections: this academic year's classes with their class teacher,
/// strength and subjects, and Add Class.
class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  late Future<List<ClassRow>> _future;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = context.read<PrincipalRepository>().classRows();
  }

  Future<void> _reload() async {
    final future = context.read<PrincipalRepository>().classRows();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _open(Widget screen, {String? savedMessage}) async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (!mounted) return;
    if (changed == true && savedMessage != null) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(savedMessage)));
    }
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Classes & Sections')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(const ClassFormScreen(), savedMessage: 'Class created.'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Class'),
      ),
      body: FutureBuilder<List<ClassRow>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(message: error is ApiException ? error.message : 'Unable to load classes.', onRetry: _reload);
          }

          final rows = snapshot.data!;
          final visible = rows.where((row) => row.matches(_query)).toList();
          final students = rows.fold<int>(0, (sum, row) => sum + row.studentCount);
          final withoutTeacher = rows.where((row) => row.classTeacherId == null).length;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                ResponsiveGrid(
                  phoneColumns: 3,
                  wideColumns: 3,
                  children: [
                    KpiCard(index: 1, label: 'Classes', value: '${rows.length}', icon: Icons.grid_view_rounded),
                    KpiCard(index: 3, label: 'Students', value: '$students', icon: Icons.groups_rounded),
                    KpiCard(index: 2, label: 'No teacher', value: '$withoutTeacher', icon: Icons.person_off_rounded),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  onChanged: (value) => setState(() => _query = value),
                  decoration: const InputDecoration(
                    hintText: 'Search class, section or teacher',
                    prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted),
                  ),
                ),
                const SizedBox(height: 12),
                if (visible.isEmpty)
                  AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: EmptyView(
                      icon: Icons.grid_view_rounded,
                      title: rows.isEmpty ? 'No classes yet' : 'No class matches',
                      message: rows.isEmpty ? 'Add the first class for this academic year.' : null,
                    ),
                  )
                else
                  for (final row in visible) ...[
                    ClassCard(
                      row: row,
                      onTap: () => _open(ClassDetailScreen(classId: row.id)),
                    ),
                    const SizedBox(height: 8),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class ClassCard extends StatelessWidget {
  const ClassCard({super.key, required this.row, this.onTap});

  final ClassRow row;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final strength = row.maximumStrength == null ? '${row.studentCount} students' : '${row.studentCount}/${row.maximumStrength} students';

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.tealSoft, borderRadius: BorderRadius.circular(AppRadii.card)),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Text(row.label, style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.teal)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Class ${row.label}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text(
                  [row.classTeacherName ?? 'No class teacher', strength].join(' · '),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                Text(
                  row.subjects.isEmpty ? 'No subjects' : row.subjects.map((subject) => subject.name).join(', '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}
