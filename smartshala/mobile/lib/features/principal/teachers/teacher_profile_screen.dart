import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/teacher_models.dart';
import '../students/student_profile_screen.dart' show whatsAppUri;
import '../widgets/management_widgets.dart';
import 'add_teacher_screen.dart';
import 'teacher_management_screen.dart' show teacherStatusChip;

/// The principal's Teacher Profile: header, Call / WhatsApp / Edit, basic
/// information, teaching details from the timetable, and this month's
/// attendance from the staff punches. Pops `true` when the teacher was edited,
/// deactivated or reactivated, so the list refreshes.
class TeacherProfileScreen extends StatefulWidget {
  const TeacherProfileScreen({super.key, required this.teacherId});

  final String teacherId;

  @override
  State<TeacherProfileScreen> createState() => _TeacherProfileScreenState();
}

class _TeacherProfileScreenState extends State<TeacherProfileScreen> {
  late Future<TeacherRow> _future;

  /// Loaded apart from the profile, so a failure here leaves the rest usable.
  late Future<TeacherAttendanceSummary> _attendance;
  final DateTime _month = DateTime.now();
  bool _changed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final repository = context.read<PrincipalRepository>();
    _future = repository.teacher(widget.teacherId);
    // Its error is shown once the profile renders; until then nothing listens.
    _attendance = repository.teacherAttendance(widget.teacherId, _month)..ignore();
  }

  void _reload() => setState(_load);

  Future<void> _launch(Uri uri) async {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No app on this phone can open that.')),
      );
    }
  }

  Future<void> _edit(TeacherRow teacher) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AddTeacherScreen(teacher: teacher)),
    );
    if (saved == true && mounted) {
      _changed = true;
      _reload();
    }
  }

  Future<void> _toggleActive(TeacherRow teacher) async {
    final deactivate = teacher.isActive;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(deactivate ? 'Deactivate teacher?' : 'Reactivate teacher?'),
        content: Text(
          deactivate
              ? '${teacher.fullName} will move to the Inactive list.'
              : '${teacher.fullName} will return to the Active list.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: deactivate ? AppColors.danger : AppColors.primary),
            child: Text(deactivate ? 'Deactivate' : 'Reactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    final repository = context.read<PrincipalRepository>();
    try {
      if (deactivate) {
        await repository.deactivateTeacher(teacher.id);
      } else {
        await repository.activateTeacher(teacher.id);
      }
      _changed = true;
      _reload();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: FutureBuilder<TeacherRow>(
        future: _future,
        builder: (context, snapshot) {
          final teacher = snapshot.data;

          return Scaffold(
            appBar: AppBar(
              title: const Text('Teacher Profile'),
              actions: [
                if (teacher != null)
                  PopupMenuButton<String>(
                    enabled: !_busy,
                    onSelected: (_) => _toggleActive(teacher),
                    itemBuilder: (_) => [
                      PopupMenuItem(
                        value: 'toggle',
                        child: Text(teacher.isActive ? 'Deactivate teacher' : 'Reactivate teacher'),
                      ),
                    ],
                  ),
              ],
            ),
            body: switch (snapshot) {
              AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
              AsyncSnapshot(hasError: true, :final error) => ErrorView(
                  message: error is ApiException ? error.message : 'Could not load this teacher.',
                  onRetry: _reload,
                ),
              _ => _body(teacher!),
            },
          );
        },
      ),
    );
  }

  Widget _body(TeacherRow teacher) {
    final hasPhone = teacher.phone.isNotEmpty;

    return RefreshIndicator(
      onRefresh: () async {
        _reload();
        await _future.then((_) {}, onError: (Object _) {});
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _Header(teacher: teacher),
          const SizedBox(height: 12),
          ResponsiveGrid(
            phoneColumns: 3,
            wideColumns: 3,
            children: [
              ProfileAction(
                icon: Icons.call_rounded,
                label: 'Call',
                color: AppColors.success,
                onTap: hasPhone ? () => _launch(Uri(scheme: 'tel', path: teacher.phone)) : null,
              ),
              ProfileAction(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                color: const Color(0xFF25D366),
                onTap: hasPhone ? () => _launch(whatsAppUri(teacher.phone)) : null,
              ),
              ProfileAction(
                icon: Icons.edit_rounded,
                label: 'Edit Profile',
                color: AppColors.primary,
                onTap: _busy ? null : () => _edit(teacher),
              ),
            ],
          ),
          const SizedBox(height: 16),
          InfoSection(title: 'Basic Information', lines: [
            ('Phone', teacher.phone),
            ('Email', teacher.email),
            ('Joined', teacher.joinedAt == null ? null : DateFormat('d MMM yyyy').format(teacher.joinedAt!)),
            ('Academic background', teacher.academicBackground),
          ]),
          InfoSection(title: 'Teaching Details', lines: [
            ('Subjects', teacher.subjects.isEmpty ? 'None assigned' : teacher.subjects.join(', ')),
            ('Classes & sections', teacher.classes.isEmpty ? 'None assigned' : teacher.classes.join(', ')),
            ('Class teacher of', teacher.classTeacherLabel),
            ('Weekly periods', '${teacher.assignedPeriods}/${teacher.totalSlots} assigned'),
          ]),
          SectionHeader(title: 'Attendance · ${DateFormat('MMMM yyyy').format(_month)}'),
          FutureBuilder<TeacherAttendanceSummary>(
            future: _attendance,
            builder: (context, snapshot) => switch (snapshot) {
              AsyncSnapshot(connectionState: ConnectionState.waiting) =>
                const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: LoadingView()),
              AsyncSnapshot(hasError: true, :final error) => AppCard(
                  child: Text(
                    error is ApiException ? error.message : 'Could not load attendance.',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
              _ => _AttendanceSummary(summary: snapshot.data!),
            },
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.teacher});

  final TeacherRow teacher;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.successSoft,
            child: Text(
              teacher.fullName.isEmpty ? '?' : teacher.fullName.characters.first.toUpperCase(),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.success),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(teacher.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, height: 1.25)),
                const SizedBox(height: 2),
                Text(
                  teacher.subjects.isEmpty ? 'Teacher' : teacher.subjects.join(', '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                teacherStatusChip(teacher),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceSummary extends StatelessWidget {
  const _AttendanceSummary({required this.summary});

  final TeacherAttendanceSummary summary;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 4,
          children: [
            KpiCard(index: 3, label: 'Present', value: '${summary.presentDays}', icon: Icons.how_to_reg_rounded),
            KpiCard(index: 2, label: 'Absent', value: '${summary.absentDays}', icon: Icons.event_busy_rounded),
            KpiCard(index: 4, label: 'Leave', value: '${summary.leaveDays}', icon: Icons.beach_access_rounded),
            KpiCard(
              index: 1,
              label: 'Attendance',
              value: summary.percentage == null ? '—' : '${summary.percentage}%',
              icon: Icons.fact_check_rounded,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          summary.workingDays == 1 ? '1 working day so far' : '${summary.workingDays} working days so far',
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
