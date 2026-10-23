import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';

/// A child's homework, split into Pending and Completed.
class ParentHomeworkScreen extends StatefulWidget {
  const ParentHomeworkScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentHomeworkScreen> createState() => _ParentHomeworkScreenState();
}

class _ParentHomeworkScreenState extends State<ParentHomeworkScreen> {
  List<HomeworkItem>? _data;
  String? _error;
  bool _loading = true;
  bool _showCompleted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ParentRepository>().homework(widget.childId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Homework & Assignments'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(widget.childName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _content(_data!),
      ),
    );
  }

  Widget _content(List<HomeworkItem> all) {
    final pending = all.where((h) => !h.completed).toList();
    final completed = all.where((h) => h.completed).toList();
    final shown = _showCompleted ? completed : pending;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: _Toggle(
            showCompleted: _showCompleted,
            pendingCount: pending.length,
            completedCount: completed.length,
            onChanged: (c) => setState(() => _showCompleted = c),
          ),
        ),
        Expanded(
          child: shown.isEmpty
              ? EmptyView(
                  icon: _showCompleted ? Icons.task_alt_rounded : Icons.assignment_outlined,
                  title: _showCompleted ? 'Nothing completed yet' : 'No pending homework',
                  message: _showCompleted
                      ? 'Completed homework will show here.'
                      : 'All caught up — new homework will appear here.',
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  itemCount: shown.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _HomeworkTile(item: shown[i]),
                ),
        ),
      ],
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.showCompleted,
    required this.pendingCount,
    required this.completedCount,
    required this.onChanged,
  });

  final bool showCompleted;
  final int pendingCount;
  final int completedCount;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, int count, bool selected, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(9),
              ),
              alignment: Alignment.center,
              child: Text(
                '$label ($count)',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          ),
        );

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Row(
        children: [
          tab('Pending', pendingCount, !showCompleted, () => onChanged(false)),
          tab('Completed', completedCount, showCompleted, () => onChanged(true)),
        ],
      ),
    );
  }
}

class _HomeworkTile extends StatelessWidget {
  const _HomeworkTile({required this.item});

  final HomeworkItem item;

  @override
  Widget build(BuildContext context) {
    final due = item.dueDate == null ? null : DateFormat('d MMM yyyy').format(item.dueDate!);
    final overdue = !item.completed && item.dueDate != null && item.dueDate!.isBefore(DateTime.now());

    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(11)),
            child: const Icon(Icons.menu_book_rounded, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.subject != null)
                  Text(item.subject!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.primary)),
                const SizedBox(height: 2),
                Text(
                  item.title,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                if (item.description != null && item.description!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ],
                if (due != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.event_outlined, size: 14, color: overdue ? AppColors.danger : AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        'Due $due',
                        style: TextStyle(
                          fontSize: 12,
                          color: overdue ? AppColors.danger : AppColors.textMuted,
                          fontWeight: overdue ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (item.completed) const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20),
        ],
      ),
    );
  }
}
