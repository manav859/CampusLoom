import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/academics_models.dart';
import '../data/teacher_repository.dart';
import 'message_parent_screen.dart';

/// The teacher's view of a student: academic and attendance information, plus a
/// Communication tab for the parent-message history and sending a new message.
///
/// The blueprint is explicit that fee information never appears in the teacher
/// portal, and the server enforces it too — a TEACHER token gets no fee fields
/// from GET /students/:id. This screen therefore has no Fees tab by design.
class StudentProfileScreen extends StatefulWidget {
  const StudentProfileScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

enum _Tab { profile, communication }

class _StudentProfileScreenState extends State<StudentProfileScreen> {
  late Future<StudentProfile> _future;
  _Tab _tab = _Tab.profile;

  @override
  void initState() {
    super.initState();
    _future = context.read<TeacherRepository>().student(widget.studentId);
  }

  void _reload() {
    setState(() {
      _future = context.read<TeacherRepository>().student(widget.studentId);
    });
  }

  Future<void> _composeMessage(StudentProfile student) async {
    final sent = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => MessageParentScreen(student: student)),
    );
    // Reload so the new message shows up in the audit straight away.
    if (sent == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Student')),
      body: FutureBuilder<StudentProfile>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingView();
          }

          if (snapshot.hasError) {
            return ErrorView(
              message: snapshot.error is ApiException
                  ? (snapshot.error as ApiException).message
                  : 'Could not load this student.',
              onRetry: _reload,
            );
          }

          final student = snapshot.data!;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _HeaderCard(student: student),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: SegmentedTabs(
                  labels: const ['Profile', 'Communication'],
                  counts: [0, student.communication.length],
                  index: _Tab.values.indexOf(_tab),
                  onChanged: (next) => setState(() => _tab = _Tab.values[next]),
                ),
              ),
              Expanded(
                child: switch (_tab) {
                  _Tab.profile => _ProfileTab(student: student),
                  _Tab.communication => _CommunicationTab(student: student),
                },
              ),
            ],
          );
        },
      ),
      floatingActionButton: _tab != _Tab.communication
          ? null
          : FutureBuilder<StudentProfile>(
              future: _future,
              builder: (context, snapshot) {
                final student = snapshot.data;
                if (student == null) return const SizedBox.shrink();
                return FloatingActionButton.extended(
                  onPressed: () => _composeMessage(student),
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  icon: const Icon(Icons.send_rounded),
                  label: const Text('Message parent'),
                );
              },
            ),
    );
  }
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab({required this.student});

  final StudentProfile student;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        const SectionHeader(title: 'Performance'),
        _PerformanceRow(student: student),
        const SizedBox(height: 20),
        const SectionHeader(title: 'Basic Information'),
        _InfoCard(student: student),
      ],
    );
  }
}

class _CommunicationTab extends StatelessWidget {
  const _CommunicationTab({required this.student});

  final StudentProfile student;

  @override
  Widget build(BuildContext context) {
    final entries = student.communication;

    if (entries.isEmpty) {
      return const EmptyView(
        icon: Icons.forum_rounded,
        title: 'No messages yet',
        message:
            'Tap "Message parent" to send a note. It reaches the parent app as a notification and shows up here.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) => _CommunicationCard(entry: entries[index]),
    );
  }
}

class _CommunicationCard extends StatelessWidget {
  const _CommunicationCard({required this.entry});

  final TeacherCommunicationEntry entry;

  @override
  Widget build(BuildContext context) {
    final tone = _statusTone(entry.status);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  DateFormat('d MMM yyyy, h:mm a').format(entry.timestamp),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
              StatusChip(
                label: _statusLabel(entry.status),
                color: tone.$1,
                tint: tone.$2,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            entry.summary,
            style: const TextStyle(
              fontSize: 13.5,
              color: AppColors.textPrimary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  String _statusLabel(String status) =>
      status.isEmpty ? '—' : status[0].toUpperCase() + status.substring(1).toLowerCase();

  (Color, Color) _statusTone(String status) {
    switch (status.toUpperCase()) {
      case 'SENT':
      case 'DELIVERED':
      case 'READ':
      case 'COMPLETED':
        return (AppColors.success, AppColors.successSoft);
      case 'QUEUED':
      case 'PENDING':
        return (AppColors.warning, AppColors.warningSoft);
      case 'FAILED':
      case 'MISSED':
        return (AppColors.danger, AppColors.dangerSoft);
      default:
        return (AppColors.textSecondary, AppColors.background);
    }
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.student});

  final StudentProfile student;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.primarySoft,
            backgroundImage: student.profilePhotoUrl == null
                ? null
                : NetworkImage(student.profilePhotoUrl!),
            child: student.profilePhotoUrl != null
                ? null
                : Text(
                    student.fullName.characters.first.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  student.fullName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  student.admissionNumber,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _Tag(label: 'Class ${student.className}', color: AppColors.primary),
                    if (student.rollNumber != null) ...[
                      const SizedBox(width: 6),
                      _Tag(label: 'Roll ${student.rollNumber}', color: AppColors.teal),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

class _PerformanceRow extends StatelessWidget {
  const _PerformanceRow({required this.student});

  final StudentProfile student;

  @override
  Widget build(BuildContext context) {
    String percent(double? value) => value == null ? '—' : '${value.round()}%';

    return Row(
      children: [
        Expanded(
          child: StatTile(
            value: percent(student.attendancePercentage),
            label: 'Attendance',
            icon: Icons.event_available_rounded,
            color: AppColors.success,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StatTile(
            value: percent(student.examAverage),
            label: 'Exam Average',
            icon: Icons.school_rounded,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StatTile(
            value: percent(student.homeworkCompletion),
            label: 'Homework',
            icon: Icons.menu_book_rounded,
            color: AppColors.purple,
          ),
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.student});

  final StudentProfile student;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      if (student.age != null) ('Age', '${student.age} years'),
      if (student.gender != null) ('Gender', _titleCase(student.gender!)),
      if (student.dateOfBirth != null)
        ('Date of Birth', DateFormat('d MMM yyyy').format(student.dateOfBirth!)),
      if (student.parentName != null && student.parentName!.isNotEmpty)
        ('Parent / Guardian', student.parentName!),
      if (student.parentPhone != null && student.parentPhone!.isNotEmpty)
        ('Contact', student.parentPhone!),
      if (student.address != null && student.address!.isNotEmpty) ('Address', student.address!),
    ];

    if (rows.isEmpty) {
      return const AppCard(
        child: Text(
          'No additional details recorded.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }

    return AppCard(
      child: Column(
        children: [
          for (var index = 0; index < rows.length; index++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 128,
                  child: Text(
                    rows[index].$1,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ),
                Expanded(
                  child: Text(
                    rows[index].$2,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
            if (index != rows.length - 1)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 11),
                child: Divider(height: 1),
              ),
          ],
        ],
      ),
    );
  }

  String _titleCase(String value) =>
      value.isEmpty ? value : value[0].toUpperCase() + value.substring(1).toLowerCase();
}
