import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/app_back_button.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/config/feature_flags.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/state_views.dart';
import '../auth/change_password_screen.dart';
import 'announcements/create_announcement_screen.dart';
import 'billing/billing_screen.dart';
import 'calendar/academic_calendar_screen.dart';
import 'classes/classes_screen.dart';
import 'exams/exams_screen.dart';
import 'fees/defaulters_screen.dart';
import 'fees/fee_management_screen.dart';
import 'inventory/inventory_screen.dart';
import 'leave/leave_approval_screen.dart';
import 'leave/student_leave_approval_screen.dart';
import 'messages/principal_messages_screen.dart';
import 'messages/message_logs_screen.dart';
import 'activity/activity_logs_screen.dart';
import 'payroll/payroll_screen.dart';
import 'reports/reports_screen.dart';
import 'reports/student_report_screen.dart';
import 'school/academic_years_screen.dart';
import 'school/school_profile_screen.dart';
import 'settings/bell_timings_screen.dart';
import 'settings/message_templates_screen.dart';
import 'students/student_management_screen.dart';
import 'subjects/subjects_screen.dart';
import 'teachers/teacher_management_screen.dart';
import '../teacher/homework/homework_screen.dart';
import '../teacher/attendance/mark_attendance_screen.dart';
import 'timetable/timetable_screen.dart';
import 'transport/transport_screen.dart';

// A principal marks any class, so the shared attendance screen opens in
// all-classes mode. A top-level tear-off keeps the menu list const.
Widget _markAttendanceForPrincipal() => const MarkAttendanceScreen(classTeacherOnly: false);

/// Every secondary module lives here rather than on Home, in the four groups
/// the blueprint defines: School Management, Academics, Finance, Communication.
class PrincipalMoreScreen extends StatefulWidget {
  const PrincipalMoreScreen({super.key});

  @override
  State<PrincipalMoreScreen> createState() => _PrincipalMoreScreenState();
}

class _PrincipalMoreScreenState extends State<PrincipalMoreScreen> {
  String _query = '';

  static const _groups = <_MoreGroup>[
    _MoreGroup(
      title: 'School Management',
      entries: [
        _MoreEntry('Student Management', 'Search, add and manage students',
            Icons.school_rounded, AppColors.primary,
            screen: StudentManagementScreen.new),
        _MoreEntry('School Profile', 'View and manage school information',
            Icons.apartment_rounded, AppColors.primary,
            screen: SchoolProfileScreen.new),
        _MoreEntry('Teacher Management', 'Manage teachers and their details',
            Icons.badge_rounded, AppColors.success,
            screen: TeacherManagementScreen.new),
        _MoreEntry('Classes & Sections', 'Manage classes and sections',
            Icons.grid_view_rounded, AppColors.teal,
            screen: ClassesScreen.new),
        _MoreEntry('Mark Attendance', 'Mark or edit attendance for any class',
            Icons.fact_check_outlined, AppColors.success,
            screen: _markAttendanceForPrincipal),
        _MoreEntry('Subjects', 'Manage subjects and curriculum',
            Icons.menu_book_rounded, AppColors.purple,
            screen: SubjectsScreen.new),
        _MoreEntry('Timetable', 'View the weekly timetable for each class',
            Icons.schedule_rounded, AppColors.warning,
            screen: TimetableScreen.new),
        _MoreEntry('Bell Timings', 'Start and end time for each period',
            Icons.notifications_active_outlined, AppColors.teal,
            screen: BellTimingsScreen.new),
        _MoreEntry('Academic Years', 'View and add academic years',
            Icons.calendar_today_rounded, AppColors.primary,
            screen: AcademicYearsScreen.new),
        _MoreEntry('Transport', 'Manage routes, vehicles and drivers',
            Icons.directions_bus_rounded, AppColors.danger,
            screen: TransportScreen.new, hidden: !kTransportEnabled),
      ],
    ),
    _MoreGroup(
      title: 'Academics',
      entries: [
        _MoreEntry('Exams', 'Manage exams, schedules and results',
            Icons.assignment_rounded, AppColors.primary,
            screen: ExamsScreen.new),
        _MoreEntry('Homework', 'Assign homework and track submissions',
            Icons.menu_book_outlined, AppColors.success,
            screen: HomeworkScreen.new),
        _MoreEntry('Reports', 'View detailed reports',
            Icons.insights_rounded, AppColors.purple,
            screen: ReportsScreen.new),
        // The web Analytics page is the student risk summary this screen reads.
        _MoreEntry('Analytics', 'Students whose attendance needs attention',
            Icons.query_stats_rounded, AppColors.danger,
            screen: StudentReportScreen.new),
        _MoreEntry('Academic Calendar', 'View events, holidays and dates',
            Icons.calendar_month_rounded, AppColors.teal,
            screen: AcademicCalendarScreen.new),
      ],
    ),
    _MoreGroup(
      title: 'Finance',
      entries: [
        _MoreEntry('Fee Management', 'Track fee collection and pending fees',
            Icons.currency_rupee_rounded, AppColors.success,
            screen: FeeManagementScreen.new),
        _MoreEntry('Fee Reports', 'View fee collection reports',
            Icons.account_balance_wallet_rounded, AppColors.teal,
            screen: DefaultersScreen.new),
        _MoreEntry('Inventory', 'Track stock and record items in or out',
            Icons.inventory_2_outlined, AppColors.purple,
            screen: InventoryScreen.new),
        _MoreEntry('Payroll', 'Shifts, salaries and pay slips from attendance',
            Icons.badge_outlined, AppColors.primary,
            screen: PayrollScreen.new, hidden: !kPayrollEnabled),
        _MoreEntry('Billing', 'Your SmartShala subscription and invoices',
            Icons.credit_card_rounded, AppColors.teal,
            screen: BillingScreen.new),
      ],
    ),
    _MoreGroup(
      title: 'Communication',
      entries: [
        _MoreEntry('Announcements', 'Send announcements to staff and parents',
            Icons.campaign_rounded, AppColors.primary,
            screen: CreateAnnouncementScreen.new),
        _MoreEntry('Messages', 'Communicate with staff and parents',
            Icons.forum_rounded, AppColors.purple,
            screen: PrincipalMessagesScreen.new),
        _MoreEntry('Message Templates', 'Edit English and Hindi message text',
            Icons.description_outlined, AppColors.teal,
            screen: MessageTemplatesScreen.new),
        _MoreEntry('Leave Approval', 'Review and approve staff leave requests',
            Icons.event_available_rounded, AppColors.warning,
            screen: LeaveApprovalScreen.new),
        _MoreEntry('Student Leave', 'Review and approve student leave requests',
            Icons.escalator_warning_rounded, AppColors.teal,
            screen: StudentLeaveApprovalScreen.new),
      ],
    ),
    _MoreGroup(
      title: 'Logs',
      entries: [
        _MoreEntry('Message Logs', 'Delivery log of parent notifications',
            Icons.mark_email_read_outlined, AppColors.primary,
            screen: MessageLogsScreen.new),
        _MoreEntry('Activity Logs', 'Audit trail of changes across the school',
            Icons.history_rounded, AppColors.purple,
            screen: ActivityLogsScreen.new),
      ],
    ),
  ];

  /// Hidden modules are left out whether or not there is a search, so they
  /// cannot be reached by searching for them either.
  List<_MoreGroup> get _filteredGroups {
    final query = _query.trim().toLowerCase();

    return _groups
        .map(
          (group) => _MoreGroup(
            title: group.title,
            entries: group.entries
                .where((entry) => !entry.hidden)
                .where((entry) =>
                    query.isEmpty ||
                    entry.title.toLowerCase().contains(query) ||
                    entry.subtitle.toLowerCase().contains(query))
                .toList(),
          ),
        )
        .where((group) => group.entries.isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final groups = _filteredGroups;

    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Text(
            'Access important tools and manage your school with ease.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5, height: 1.4),
          ),
          const SizedBox(height: 16),
          TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: const InputDecoration(
              hintText: 'Search anything...',
              prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 22),
          if (groups.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: EmptyView(
                icon: Icons.search_off_rounded,
                title: 'Nothing found',
                message: 'No module matches that search.',
              ),
            ),
          for (final group in groups) ...[
            SectionHeader(title: group.title),
            for (final entry in group.entries) ...[
              ListRowCard(
                icon: entry.icon,
                title: entry.title,
                subtitle: entry.subtitle,
                color: entry.color,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => entry.screen(),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen()),
            ),
            icon: const Icon(Icons.lock_reset_rounded, size: 20),
            label: const Text('Change Password'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.read<AuthController>().logout(),
            icon: const Icon(Icons.logout_rounded, size: 20),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _MoreGroup {
  const _MoreGroup({required this.title, required this.entries});

  final String title;
  final List<_MoreEntry> entries;
}

class _MoreEntry {
  const _MoreEntry(this.title, this.subtitle, this.icon, this.color, {required this.screen, this.hidden = false});

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Widget Function() screen;

  /// Modules turned off in feature_flags.dart: kept here, never listed.
  final bool hidden;
}
