import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';
import 'parent_academics_screen.dart';
import 'parent_attendance_screen.dart';
import 'parent_homework_screen.dart';
import 'widgets/attendance_bits.dart';

/// The Home tab for the selected child. Phase 2 shows today's attendance and
/// this month's attendance summary; fees, events and announcements arrive in
/// their own phases.
class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key, required this.child});

  final ParentChild child;

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  ChildHome? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(ParentHomeScreen old) {
    super.didUpdateWidget(old);
    // Switching child re-fetches.
    if (old.child.id != widget.child.id) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ParentRepository>().home(widget.child.id);
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

  void _open(Widget Function(String id, String name) builder) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => builder(widget.child.id, widget.child.fullName),
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final data = _data!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          _TodayCard(status: data.todayStatus),
          const SizedBox(height: 14),
          _AttendanceCard(
            summary: data.attendance,
            onTap: () => _open((id, name) => ParentAttendanceScreen(childId: id, childName: name)),
          ),
          const SizedBox(height: 18),
          const _SectionLabel('Quick links'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: HomeQuickAction(
                  icon: Icons.insights_rounded,
                  title: 'Academics',
                  chip: AppColors.purpleSoft,
                  accent: AppColors.purple,
                  onTap: () => _open((id, name) => ParentAcademicsScreen(childId: id, childName: name)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: HomeQuickAction(
                  icon: Icons.menu_book_rounded,
                  title: 'Homework',
                  chip: AppColors.tealSoft,
                  accent: AppColors.teal,
                  onTap: () => _open((id, name) => ParentHomeworkScreen(childId: id, childName: name)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
    );
  }
}

/// How the child was marked today — or that attendance has not been taken yet.
class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.status});

  final AttendanceStatus? status;

  @override
  Widget build(BuildContext context) {
    final marked = status != null && status != AttendanceStatus.unknown;
    final color = marked ? attendanceColor(status!) : AppColors.textMuted;
    final ground = marked ? attendanceSoft(status!) : AppColors.background;

    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: ground, borderRadius: BorderRadius.circular(12)),
            child: Icon(
              marked
                  ? (status == AttendanceStatus.present
                      ? Icons.check_circle_rounded
                      : status == AttendanceStatus.absent
                          ? Icons.cancel_rounded
                          : Icons.event_busy_rounded)
                  : Icons.schedule_rounded,
              color: color,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Today's attendance",
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 3),
                Text(
                  marked ? attendanceLabel(status!) : 'Not marked yet',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: marked ? color : AppColors.textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.summary, required this.onTap});

  final AttendanceSummary summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final monthLabel = summary.month.isEmpty
        ? ''
        : DateFormat('MMMM yyyy').format(DateTime.parse('${summary.month}-01'));

    return HomeSurface(
      padding: const EdgeInsets.all(16),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Attendance',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              Text(monthLabel, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              AttendanceRing(percentage: summary.percentage, size: 92),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  children: [
                    _StatRow(label: 'Present', value: summary.present, color: AppColors.success),
                    const SizedBox(height: 8),
                    _StatRow(label: 'Absent', value: summary.absent, color: AppColors.danger),
                    const SizedBox(height: 8),
                    _StatRow(label: 'Total days', value: summary.totalDays, color: AppColors.textSecondary),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value, required this.color});

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
        Text(
          '$value',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
      ],
    );
  }
}
