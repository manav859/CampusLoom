import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';
import 'create_homework_screen.dart';
import 'homework_submissions_screen.dart';

class HomeworkScreen extends StatefulWidget {
  const HomeworkScreen({super.key});

  @override
  State<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends State<HomeworkScreen> {
  late Future<List<HomeworkAssignment>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<TeacherRepository>().homeworkAssignments();
  }

  Future<void> _refresh() async {
    final future = context.read<TeacherRepository>().homeworkAssignments();
    setState(() { _future = future; });
    await future.catchError((Object _) => <HomeworkAssignment>[]);
  }

  Future<void> _openCreate() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const CreateHomeworkScreen()),
    );
    if (created == true) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<HomeworkAssignment>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const LoadingView(message: 'Loading homework…');
            }

            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  ErrorView(
                    message: snapshot.error is ApiException
                        ? (snapshot.error as ApiException).message
                        : 'Could not load homework.',
                    onRetry: _refresh,
                  ),
                ],
              );
            }

            final assignments = snapshot.data ?? const <HomeworkAssignment>[];
            if (assignments.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyView(
                    icon: Icons.menu_book_rounded,
                    title: 'No homework yet',
                    message: 'Tap "Create Homework" to assign work to one of your classes.',
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: assignments.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _AssignmentCard(
                assignment: assignments[index],
                onTap: () async {
                  await Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => HomeworkSubmissionsScreen(assignmentId: assignments[index].id),
                    ),
                  );
                  await _refresh();
                },
              ),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Create Homework'),
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.assignment, required this.onTap});

  final HomeworkAssignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final submitted = assignment.submittedCount;
    final total = assignment.totalStudents;
    final ratio = total == 0 ? 0.0 : submitted / total;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  assignment.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: assignment.isOverdue ? AppColors.dangerSoft : AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  assignment.isOverdue ? 'Overdue' : 'Active',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: assignment.isOverdue ? AppColors.danger : AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            'Class ${assignment.className} • ${assignment.subject}',
            style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 3),
          Text(
            'Due ${DateFormat('d MMM yyyy').format(assignment.dueDate)}',
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 6,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.success),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            '$submitted/$total submitted',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.success,
            ),
          ),
        ],
      ),
    );
  }
}
