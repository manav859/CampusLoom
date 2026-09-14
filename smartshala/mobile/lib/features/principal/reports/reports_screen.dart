import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../exams/exams_screen.dart';
import 'attendance_report_screen.dart';
import 'class_performance_report_screen.dart';
import 'student_report_screen.dart';
import 'subject_performance_report_screen.dart';
import 'teacher_report_screen.dart';

typedef ReportEntry = ({String title, String subtitle, IconData icon, Color color, Widget Function() screen});

/// Reports: academic and operational insight only. Per the blueprint there is
/// no Finance here — fee reports live under More → Finance.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  /// Shown as tiles, per the blueprint's Quick Access row.
  static final List<ReportEntry> quickAccess = [
    (
      title: 'Student Report',
      subtitle: 'Students needing attention',
      icon: Icons.school_rounded,
      color: AppColors.primary,
      screen: StudentReportScreen.new,
    ),
    (
      title: 'Attendance Report',
      subtitle: 'Classes marked and rates',
      icon: Icons.fact_check_rounded,
      color: AppColors.success,
      screen: AttendanceReportScreen.new,
    ),
    (
      title: 'Teacher Report',
      subtitle: 'Periods and attendance duty',
      icon: Icons.badge_rounded,
      color: AppColors.purple,
      screen: TeacherReportScreen.new,
    ),
    (
      title: 'Exam Report',
      subtitle: 'Exams, averages and marks',
      icon: Icons.assignment_rounded,
      color: AppColors.warning,
      screen: ExamsScreen.new,
    ),
  ];

  /// Listed below the tiles, per the blueprint's Detailed Reports.
  static final List<ReportEntry> detailed = [
    (
      title: 'Class Wise Performance',
      subtitle: 'Attendance this month and exam averages by class',
      icon: Icons.grid_view_rounded,
      color: AppColors.teal,
      screen: ClassPerformanceReportScreen.new,
    ),
    (
      title: 'Subject Wise Performance',
      subtitle: 'Exam averages by class and subject',
      icon: Icons.menu_book_rounded,
      color: AppColors.purple,
      screen: SubjectPerformanceReportScreen.new,
    ),
    (
      title: 'Daily Attendance',
      subtitle: 'Today, this week or this month, with export',
      icon: Icons.event_available_rounded,
      color: AppColors.success,
      screen: AttendanceReportScreen.new,
    ),
  ];

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _query = '';

  List<ReportEntry> _matching(List<ReportEntry> reports) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return reports;
    return reports
        .where((report) => report.title.toLowerCase().contains(query) || report.subtitle.toLowerCase().contains(query))
        .toList();
  }

  void _open(ReportEntry report) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => report.screen()));

  @override
  Widget build(BuildContext context) {
    final quick = _matching(ReportsScreen.quickAccess);
    final detailed = _matching(ReportsScreen.detailed);

    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          const Text(
            'Academic and operational reports for your school.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
          ),
          const SizedBox(height: 14),
          TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: const InputDecoration(
              hintText: 'Search reports...',
              prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 20),
          if (quick.isEmpty && detailed.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: EmptyView(icon: Icons.search_off_rounded, title: 'Nothing found', message: 'No report matches that search.'),
            ),
          if (quick.isNotEmpty) ...[
            const SectionHeader(title: 'Quick Access'),
            ResponsiveGrid(
              phoneColumns: 2,
              wideColumns: 4,
              children: [
                for (final report in quick)
                  QuickActionTile(
                    icon: report.icon,
                    title: report.title,
                    subtitle: report.subtitle,
                    color: report.color,
                    onTap: () => _open(report),
                  ),
              ],
            ),
            const SizedBox(height: 22),
          ],
          if (detailed.isNotEmpty) ...[
            const SectionHeader(title: 'Detailed Reports'),
            for (final report in detailed) ...[
              ListRowCard(
                icon: report.icon,
                title: report.title,
                subtitle: report.subtitle,
                color: report.color,
                onTap: () => _open(report),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ],
      ),
    );
  }
}
