import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/data/calendar_models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_chips.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_repository.dart';

/// The exam datesheet the school publishes on its calendar, split into what is
/// still to come and what is over. Marks for an exam that has been sat are on
/// the Academics screen — this one is only about when they are.
class ParentExamScheduleScreen extends StatefulWidget {
  const ParentExamScheduleScreen({super.key, required this.childName});

  /// Exams are published school-wide, so the child is named for context only.
  final String childName;

  @override
  State<ParentExamScheduleScreen> createState() => _ParentExamScheduleScreenState();
}

class _ParentExamScheduleScreenState extends State<ParentExamScheduleScreen> {
  ExamSchedule? _data;
  String? _error;
  bool _loading = true;
  int _tab = 0;

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
      final data = await context.read<ParentRepository>().examSchedule();
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
        title: const Text('Exam Schedule'),
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

  Widget _content(ExamSchedule schedule) {
    final shown = _tab == 0 ? schedule.upcoming : schedule.past;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: SegmentedTabs(
            labels: const ['Upcoming', 'Completed'],
            counts: [schedule.upcoming.length, schedule.past.length],
            index: _tab,
            onChanged: (index) => setState(() => _tab = index),
          ),
        ),
        Expanded(
          child: shown.isEmpty
              ? EmptyView(
                  icon: Icons.edit_calendar_rounded,
                  title: _tab == 0 ? 'No exams scheduled' : 'No exams yet',
                  message: _tab == 0
                      ? 'Exam dates published by the school will appear here.'
                      : 'Exams that have been sat will appear here.',
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: shown.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, index) => _ExamTile(exam: shown[index], past: _tab == 1),
                  ),
                ),
        ),
      ],
    );
  }
}

/// One exam: the start day on a tinted block, then the title, the span and the
/// time. A past exam reads in muted ink so the two halves are told apart at a
/// glance.
class _ExamTile extends StatelessWidget {
  const _ExamTile({required this.exam, required this.past});

  final CalendarEvent exam;
  final bool past;

  @override
  Widget build(BuildContext context) {
    final accent = past ? AppColors.textMuted : AppColors.purple;
    final tint = past ? AppColors.background : AppColors.purpleSoft;
    final span = exam.isMultiDay
        ? '${DateFormat('d MMM').format(exam.startDate)} – ${DateFormat('d MMM yyyy').format(exam.endDate)}'
        : DateFormat('EEEE, d MMM yyyy').format(exam.startDate);

    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(11)),
            child: Column(
              children: [
                Text(
                  DateFormat('MMM').format(exam.startDate).toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent),
                ),
                Text(
                  '${exam.startDate.day}',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: accent),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  exam.title,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 3),
                Text(span, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                if (exam.description != null && exam.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    exam.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
                  ),
                ],
                if (exam.timeLabel != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.schedule_rounded, size: 14, color: accent),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          exam.timeLabel!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: accent),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
