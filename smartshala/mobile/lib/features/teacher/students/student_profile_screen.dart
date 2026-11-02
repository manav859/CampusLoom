import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/data/student_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/message_parent_screen.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/teacher_repository.dart';

/// A wa.me link for an Indian number: the last ten digits with the 91 prefix.
Uri _whatsAppUri(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  final local = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
  return Uri.parse('https://wa.me/91$local');
}

/// The teacher's view of a student. It shows the same record the principal sees,
/// limited to the tabs the server allows a TEACHER token (`access.allowedTabs`):
/// no Documents tab, and fees appear only as a summary badge — never a payment
/// ledger. A Communication tab lists the parent-message history and sends new
/// messages to the parent app.
class StudentProfileScreen extends StatefulWidget {
  const StudentProfileScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

enum _Tab {
  overview('Overview', null),
  academics('Academics', 'academic'),
  attendance('Attendance', 'attendance'),
  fees('Fees', 'fees'),
  behaviour('Behaviour', 'behaviour'),
  communication('Communication', 'communication');

  const _Tab(this.label, this.permission);

  final String label;

  /// The server's tab key in `access.allowedTabs`; Overview needs none.
  final String? permission;
}

class _StudentProfileScreenState extends State<StudentProfileScreen> {
  late Future<StudentDetail> _future;
  _Tab _tab = _Tab.overview;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<StudentDetail> _load() => context.read<TeacherRepository>().student(widget.studentId);

  void _reload() => setState(() => _future = _load());

  Future<void> _launch(Uri uri) async {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No app on this phone can open that.')),
      );
    }
  }

  Future<void> _composeMessage(StudentDetail student) async {
    final repository = context.read<TeacherRepository>();
    final sent = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => MessageParentScreen(
          studentName: student.fullName,
          className: student.className,
          parentName: student.parentName,
          onSend: ({required type, required message}) =>
              repository.sendParentMessage(studentId: student.id, type: type, message: message),
        ),
      ),
    );
    // Reload so the new message shows up in the audit straight away.
    if (sent == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Student')),
      body: FutureBuilder<StudentDetail>(
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
          return _body(snapshot.data!);
        },
      ),
      floatingActionButton: _tab != _Tab.communication
          ? null
          : FutureBuilder<StudentDetail>(
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

  Widget _body(StudentDetail student) {
    final tabs = _Tab.values
        .where((tab) => tab.permission == null || student.can(tab.permission!))
        .toList();
    final tab = tabs.contains(_tab) ? _tab : _Tab.overview;

    return RefreshIndicator(
      onRefresh: () async {
        _reload();
        await _future.then((_) {}, onError: (Object _) {});
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          _Header(student: student),
          const SizedBox(height: 12),
          _QuickFacts(student: student),
          const SizedBox(height: 12),
          ResponsiveGrid(
            phoneColumns: 3,
            wideColumns: 3,
            children: [
              _Action(
                icon: Icons.call_rounded,
                label: 'Call Parent',
                color: AppColors.success,
                onTap: student.parentPhone.isEmpty
                    ? null
                    : () => _launch(Uri(scheme: 'tel', path: student.parentPhone)),
              ),
              _Action(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                color: const Color(0xFF25D366),
                onTap: student.parentPhone.isEmpty ? null : () => _launch(_whatsAppUri(student.parentPhone)),
              ),
              _Action(
                icon: Icons.send_rounded,
                label: 'Message',
                color: AppColors.primary,
                onTap: student.can('communication') ? () => _composeMessage(student) : null,
              ),
            ],
          ),
          const SizedBox(height: 16),
          SegmentedTabs(
            labels: [for (final item in tabs) item.label],
            index: tabs.indexOf(tab),
            onChanged: (index) => setState(() => _tab = tabs[index]),
          ),
          const SizedBox(height: 14),
          switch (tab) {
            _Tab.overview => _OverviewTab(student: student),
            _Tab.academics => _AcademicsTab(student: student),
            _Tab.attendance => _AttendanceTab(metrics: student.attendance),
            _Tab.fees => _FeesTab(summary: student.feeSummary),
            _Tab.behaviour => _BehaviourTab(behaviour: student.behaviour),
            _Tab.communication => _CommunicationTab(entries: student.communication),
          },
        ],
      ),
    );
  }
}

final _day = DateFormat('d MMM yyyy');

String _percent(double? value) => value == null ? '—' : '${value.round()}%';

class _Header extends StatelessWidget {
  const _Header({required this.student});

  final StudentDetail student;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.primarySoft,
            backgroundImage: student.profilePhotoUrl == null ? null : NetworkImage(student.profilePhotoUrl!),
            child: student.profilePhotoUrl != null
                ? null
                : Text(
                    student.fullName.isEmpty ? '?' : student.fullName.characters.first.toUpperCase(),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(student.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, height: 1.25)),
                const SizedBox(height: 2),
                Text('ID ${student.admissionNumber}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusChip(label: 'Class ${student.className}', color: AppColors.primary, tint: AppColors.primarySoft),
                    if (student.rollNumber != null)
                      StatusChip(label: 'Roll ${student.rollNumber}', color: AppColors.teal, tint: AppColors.tealSoft),
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

class _QuickFacts extends StatelessWidget {
  const _QuickFacts({required this.student});

  final StudentDetail student;

  @override
  Widget build(BuildContext context) {
    final facts = [
      ('Age', student.age == null ? '—' : '${student.age} yrs'),
      ('Gender', student.gender == null ? '—' : humanizeConstant(student.gender!)),
      ('Date of birth', student.dateOfBirth == null ? '—' : _day.format(student.dateOfBirth!)),
      ('Joined', student.joiningDate == null ? '—' : _day.format(student.joiningDate!)),
    ];

    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 4,
      spacing: 8,
      children: [
        for (final (label, value) in facts)
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.student});

  final StudentDetail student;

  @override
  Widget build(BuildContext context) {
    String? withPhone(String? name, String? phone) =>
        name == null || name.isEmpty ? phone : (phone == null || phone.isEmpty ? name : '$name · $phone');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _InfoSection(title: 'Class Information', lines: [
          ('Class', student.className),
          ('Roll number', student.rollNumber?.toString()),
          ('Academic year', student.academicYear),
          ('Transport', student.transportRequired ? 'Required' : 'Not required'),
          ('Previous school', student.previousSchool),
        ]),
        _InfoSection(title: 'Parent / Guardian', lines: [
          ('Primary contact', withPhone(student.parentName, student.parentPhone)),
          ('Alternate phone', student.alternatePhone),
          ('Father', withPhone(student.fatherName, student.fatherPhone)),
          ('Mother', withPhone(student.motherName, student.motherPhone)),
          ('Guardian', withPhone(student.guardianName, student.guardianPhone)),
          ('Address', student.address),
        ]),
        if (student.can('attendance')) ...[
          const SectionHeader(title: 'Attendance Summary'),
          _AttendanceTiles(metrics: student.attendance),
          const SizedBox(height: 16),
        ],
        if (student.siblings.isNotEmpty)
          _InfoSection(title: 'Siblings', lines: [
            for (final sibling in student.siblings) (sibling.fullName, 'Class ${sibling.className}'),
          ]),
      ],
    );
  }
}

/// The teacher's fee view: a balance summary only. The server never sends a
/// teacher the payment ledger, so there is nothing to drill into here.
class _FeesTab extends StatelessWidget {
  const _FeesTab({required this.summary});

  final FeeSummary summary;

  @override
  Widget build(BuildContext context) {
    if (summary.status == 'NONE') {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.receipt_long_outlined,
          title: 'No fees assigned',
          message: 'Fee structures are assigned on the web dashboard.',
        ),
      );
    }

    final overdue = summary.status == 'OVERDUE';
    final paid = summary.status == 'PAID';
    final color = overdue ? AppColors.danger : (paid ? AppColors.success : AppColors.warning);
    final tint = overdue ? AppColors.dangerSoft : (paid ? AppColors.successSoft : AppColors.warningSoft);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: StatusChip(label: summary.label, color: color, tint: tint),
        ),
        const SizedBox(height: 12),
        ResponsiveGrid(
          phoneColumns: 3,
          wideColumns: 3,
          children: [
            KpiCard(index: 1, label: 'Total', value: formatInr(summary.totalPayable), icon: Icons.receipt_long_rounded),
            KpiCard(index: 3, label: 'Paid', value: formatInr(summary.totalPaid), icon: Icons.check_circle_rounded),
            KpiCard(index: 2, label: 'Balance', value: formatInr(summary.balance), icon: Icons.pending_actions_rounded),
          ],
        ),
      ],
    );
  }
}

class _AttendanceTiles extends StatelessWidget {
  const _AttendanceTiles({required this.metrics});

  final AttendanceMetrics metrics;

  @override
  Widget build(BuildContext context) {
    return ResponsiveGrid(
      phoneColumns: 2,
      wideColumns: 4,
      children: [
        KpiCard(index: 3, label: 'Attendance', value: _percent(metrics.percentage), icon: Icons.fact_check_rounded),
        KpiCard(index: 1, label: 'Days recorded', value: '${metrics.totalDays}', icon: Icons.calendar_month_rounded),
        KpiCard(index: 2, label: 'Absences', value: '${metrics.absences}', icon: Icons.event_busy_rounded),
        KpiCard(index: 0, label: 'Class average', value: _percent(metrics.classAverage), icon: Icons.groups_rounded),
      ],
    );
  }
}

class _AttendanceTab extends StatelessWidget {
  const _AttendanceTab({required this.metrics});

  final AttendanceMetrics metrics;

  @override
  Widget build(BuildContext context) {
    if (metrics.totalDays == 0) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.fact_check_outlined,
          title: 'No attendance yet',
          message: 'Attendance appears once this student’s class is marked.',
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AttendanceTiles(metrics: metrics),
        const SizedBox(height: 16),
        _InfoSection(title: 'Details', lines: [
          ('On leave', '${metrics.leaves}'),
          if (metrics.remainingBefore75 != null)
            ('Before 75%', '${metrics.remainingBefore75} more absences allowed'),
        ]),
      ],
    );
  }
}

class _AcademicsTab extends StatelessWidget {
  const _AcademicsTab({required this.student});

  final StudentDetail student;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 4,
          children: [
            KpiCard(index: 0, label: 'Performance', value: _percent(student.performanceRate), icon: Icons.insights_rounded),
            KpiCard(index: 1, label: 'Exam average', value: _percent(student.examAverage), icon: Icons.assignment_rounded),
            KpiCard(index: 4, label: 'Homework', value: _percent(student.homeworkCompletion), icon: Icons.menu_book_rounded),
            KpiCard(index: 3, label: 'Class rank', value: student.currentRank == null ? '—' : '#${student.currentRank}', icon: Icons.emoji_events_rounded),
          ],
        ),
        const SizedBox(height: 16),
        if (student.subjects.isNotEmpty)
          _InfoSection(title: 'Subjects', lines: [
            for (final subject in student.subjects)
              (subject.subject, '${subject.studentAverage}% · class ${subject.classAverage}%'),
          ]),
        const SectionHeader(title: 'Exam Results'),
        if (student.exams.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(icon: Icons.assignment_outlined, title: 'No exam results yet'),
          )
        else
          for (final exam in student.exams)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(exam.examName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          Text(
                            [exam.subject, if (exam.examDate != null) _day.format(exam.examDate!)]
                                .where((part) => part.isNotEmpty)
                                .join(' · '),
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(exam.marks, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        Text(
                          [if (exam.grade != null) exam.grade!, _percent(exam.percentage)].join(' · '),
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _BehaviourTab extends StatelessWidget {
  const _BehaviourTab({required this.behaviour});

  final BehaviourAnalytics behaviour;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          phoneColumns: 2,
          wideColumns: 2,
          children: [
            KpiCard(index: 2, label: 'Incidents', value: '${behaviour.incidents}', icon: Icons.report_rounded),
            KpiCard(index: 3, label: 'Achievements', value: '${behaviour.achievements}', icon: Icons.emoji_events_rounded),
          ],
        ),
        const SizedBox(height: 16),
        if (behaviour.records.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(
              icon: Icons.emoji_people_rounded,
              title: 'No behaviour records',
              message: 'Incidents and achievements logged for this student appear here.',
            ),
          )
        else
          for (final record in behaviour.records)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(record.title.isEmpty ? humanizeConstant(record.type) : record.title,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        ),
                        StatusChip(
                          label: humanizeConstant(record.type),
                          color: record.type == 'ACHIEVEMENT' ? AppColors.success : AppColors.warning,
                          tint: record.type == 'ACHIEVEMENT' ? AppColors.successSoft : AppColors.warningSoft,
                        ),
                      ],
                    ),
                    if (record.summary.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(record.summary, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.35)),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      [
                        _day.format(record.occurredAt),
                        if (record.createdByName != null) 'by ${record.createdByName}',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _CommunicationTab extends StatelessWidget {
  const _CommunicationTab({required this.entries});

  final List<CommunicationEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.forum_rounded,
          title: 'No messages yet',
          message: 'Tap "Message parent" to send a note. It reaches the parent app as a notification and shows up here.',
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _CommunicationCard(entry: entry),
          ),
      ],
    );
  }
}

class _CommunicationCard extends StatelessWidget {
  const _CommunicationCard({required this.entry});

  final CommunicationEntry entry;

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
              StatusChip(label: _statusLabel(entry.status), color: tone.$1, tint: tone.$2),
            ],
          ),
          const SizedBox(height: 8),
          Text(entry.summary, style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary, height: 1.4)),
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

/// A titled card of label/value rows; a row whose value is null or empty is
/// skipped, and the whole section disappears if nothing is left.
class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.title, required this.lines});

  final String title;
  final List<(String, String?)> lines;

  @override
  Widget build(BuildContext context) {
    final rows = [
      for (final (label, value) in lines)
        if (value != null && value.trim().isNotEmpty) (label, value),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(title: title),
        AppCard(
          child: Column(
            children: [
              for (var index = 0; index < rows.length; index++) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 128,
                      child: Text(rows[index].$1,
                          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
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
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.color, this.onTap});

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return AppCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Column(
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(height: 6),
                Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
