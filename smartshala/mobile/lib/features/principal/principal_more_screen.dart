import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_cards.dart';
import '../../core/widgets/placeholder_screen.dart';
import '../../core/widgets/state_views.dart';
import 'announcements/create_announcement_screen.dart';
import 'leave/leave_approval_screen.dart';
import 'messages/principal_messages_screen.dart';

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
        _MoreEntry('School Profile', 'View and manage school information',
            Icons.apartment_rounded, AppColors.primary, 'Phase 5'),
        _MoreEntry('Teacher Management', 'Manage teachers and their details',
            Icons.badge_rounded, AppColors.success, 'Phase 5'),
        _MoreEntry('Classes & Sections', 'Manage classes and sections',
            Icons.grid_view_rounded, AppColors.teal, 'Phase 5'),
        _MoreEntry('Subjects', 'Manage subjects and curriculum',
            Icons.menu_book_rounded, AppColors.purple, 'Phase 5'),
        _MoreEntry('Timetable', 'View and manage class timetable',
            Icons.schedule_rounded, AppColors.warning, 'Phase 7'),
        _MoreEntry('Transport', 'Manage routes, vehicles and drivers',
            Icons.directions_bus_rounded, AppColors.danger, 'Phase 7'),
      ],
    ),
    _MoreGroup(
      title: 'Academics',
      entries: [
        _MoreEntry('Exams', 'Manage exams, schedules and results',
            Icons.assignment_rounded, AppColors.primary, 'Phase 6'),
        _MoreEntry('Reports', 'View detailed reports and analytics',
            Icons.insights_rounded, AppColors.purple, 'Phase 6'),
        _MoreEntry('Academic Calendar', 'View events, holidays and dates',
            Icons.calendar_month_rounded, AppColors.teal, 'Phase 6'),
      ],
    ),
    _MoreGroup(
      title: 'Finance',
      entries: [
        _MoreEntry('Fee Management', 'Track fee collection and pending fees',
            Icons.currency_rupee_rounded, AppColors.success, 'Phase 5'),
        _MoreEntry('Fee Reports', 'View fee collection reports',
            Icons.account_balance_wallet_rounded, AppColors.teal, 'Phase 5'),
      ],
    ),
    _MoreGroup(
      title: 'Communication',
      entries: [
        _MoreEntry('Announcements', 'Send announcements to staff and parents',
            Icons.campaign_rounded, AppColors.primary, 'Phase 4',
            screen: CreateAnnouncementScreen.new),
        _MoreEntry('Messages', 'Communicate with staff and parents',
            Icons.forum_rounded, AppColors.purple, 'Phase 4',
            screen: PrincipalMessagesScreen.new),
        _MoreEntry('Leave Approval', 'Review and approve leave requests',
            Icons.event_available_rounded, AppColors.warning, 'Phase 4',
            screen: LeaveApprovalScreen.new),
        _MoreEntry('Notifications', 'View all school notifications',
            Icons.notifications_active_rounded, AppColors.danger, 'Phase 8'),
      ],
    ),
  ];

  List<_MoreGroup> get _filteredGroups {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _groups;

    return _groups
        .map(
          (group) => _MoreGroup(
            title: group.title,
            entries: group.entries
                .where((entry) =>
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
      appBar: AppBar(title: const Text('More')),
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
                    builder: (_) =>
                        entry.screen?.call() ??
                        PlaceholderScreen(
                          title: entry.title,
                          icon: entry.icon,
                          phase: entry.phase,
                        ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 12),
          ],
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
  const _MoreEntry(this.title, this.subtitle, this.icon, this.color, this.phase, {this.screen});

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String phase;

  /// Built modules point at their screen; the rest still open the labelled
  /// placeholder that names the phase they arrive in.
  final Widget Function()? screen;
}
