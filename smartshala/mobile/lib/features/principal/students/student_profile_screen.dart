import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/student_models.dart';
import '../fees/student_fee_ledger_screen.dart';
import '../widgets/management_widgets.dart';

/// A wa.me link for an Indian number: the last ten digits with the 91 prefix,
/// so "+91 98765 00001" and "9876500001" open the same chat.
Uri whatsAppUri(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  final local = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
  return Uri.parse('https://wa.me/91$local');
}

enum _Tab {
  overview('Overview', null),
  academics('Academics', 'academic'),
  attendance('Attendance', 'attendance'),
  fees('Fees', 'fees'),
  documents('Documents', 'documents');

  const _Tab(this.label, this.permission);

  final String label;

  /// The server's tab key in `access.allowedTabs`; Overview needs none.
  final String? permission;
}

/// The principal's Student Profile. Tabs follow what the server allows this
/// role (`access.allowedTabs`), the same list the web profile uses. Pops `true`
/// when the student was deactivated or reactivated, so the list refreshes.
class PrincipalStudentProfileScreen extends StatefulWidget {
  const PrincipalStudentProfileScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<PrincipalStudentProfileScreen> createState() => _PrincipalStudentProfileScreenState();
}

class _PrincipalStudentProfileScreenState extends State<PrincipalStudentProfileScreen> {
  late Future<StudentDetail> _future;
  _Tab _tab = _Tab.overview;
  bool _changed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<StudentDetail> _load() => context.read<PrincipalRepository>().student(widget.studentId);

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _launch(Uri uri) async {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No app on this phone can open that.')),
      );
    }
  }

  Future<void> _toggleActive(StudentDetail student) async {
    final deactivate = student.isActive;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(deactivate ? 'Deactivate student?' : 'Reactivate student?'),
        content: Text(
          deactivate
              ? '${student.fullName} will move to the Inactive list and drop out of attendance and fee lists.'
              : '${student.fullName} will return to the Active list.',
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
        await repository.deactivateStudent(student.id);
      } else {
        await repository.activateStudent(student.id);
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
      child: FutureBuilder<StudentDetail>(
        future: _future,
        builder: (context, snapshot) {
          final student = snapshot.data;

          return Scaffold(
            appBar: AppBar(
              title: const Text('Student Profile'),
              actions: [
                if (student != null)
                  PopupMenuButton<String>(
                    enabled: !_busy,
                    onSelected: (_) => _toggleActive(student),
                    itemBuilder: (_) => [
                      PopupMenuItem(
                        value: 'toggle',
                        child: Text(student.isActive ? 'Deactivate student' : 'Reactivate student'),
                      ),
                    ],
                  ),
              ],
            ),
            body: switch (snapshot) {
              AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
              AsyncSnapshot(hasError: true, :final error) => ErrorView(
                  message: error is ApiException ? error.message : 'Could not load this student.',
                  onRetry: _reload,
                ),
              _ => _body(student!),
            },
          );
        },
      ),
    );
  }

  Widget _body(StudentDetail student) {
    final tabs = _Tab.values.where((tab) => tab.permission == null || student.can(tab.permission!)).toList();
    final tab = tabs.contains(_tab) ? _tab : _Tab.overview;

    return RefreshIndicator(
      onRefresh: () async {
        _reload();
        await _future.then((_) {}, onError: (Object _) {});
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _Header(student: student),
          const SizedBox(height: 12),
          _QuickFacts(student: student),
          const SizedBox(height: 12),
          ResponsiveGrid(
            phoneColumns: 3,
            wideColumns: 3,
            children: [
              ProfileAction(
                icon: Icons.call_rounded,
                label: 'Call Parent',
                color: AppColors.success,
                onTap: student.parentPhone.isEmpty ? null : () => _launch(Uri(scheme: 'tel', path: student.parentPhone)),
              ),
              ProfileAction(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                color: const Color(0xFF25D366),
                onTap: student.parentPhone.isEmpty
                    ? null
                    : () => _launch(whatsAppUri(student.parentPhone)),
              ),
              ProfileAction(
                icon: Icons.fact_check_rounded,
                label: 'Attendance',
                color: AppColors.primary,
                onTap: student.can('attendance') ? () => setState(() => _tab = _Tab.attendance) : null,
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
            _Tab.fees => _FeesTab(student: student),
            _Tab.documents => _DocumentsTab(documents: student.documents),
          },
        ],
      ),
    );
  }
}

final _day = DateFormat('d MMM yyyy');

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
                Text(
                  'ID ${student.admissionNumber}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusChip(label: 'Class ${student.className}', color: AppColors.primary, tint: AppColors.primarySoft),
                    if (student.rollNumber != null)
                      StatusChip(label: 'Roll ${student.rollNumber}', color: AppColors.teal, tint: AppColors.tealSoft),
                    student.isActive
                        ? const StatusChip(label: 'Active', color: AppColors.success, tint: AppColors.successSoft)
                        : const StatusChip(label: 'Inactive', color: AppColors.danger, tint: AppColors.dangerSoft),
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
        InfoSection(title: 'Class Information', lines: [
          ('Class', student.className),
          ('Roll number', student.rollNumber?.toString()),
          ('Academic year', student.academicYear),
          ('Transport', student.transportRequired ? 'Required' : 'Not required'),
          ('Previous school', student.previousSchool),
        ]),
        InfoSection(title: 'Parent / Guardian', lines: [
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
          InfoSection(title: 'Siblings', lines: [
            for (final sibling in student.siblings) (sibling.fullName, 'Class ${sibling.className}'),
          ]),
      ],
    );
  }
}

String _percent(double? value) => value == null ? '—' : '${value.round()}%';

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
        InfoSection(title: 'Details', lines: [
          ('Late', '${metrics.late}'),
          ('Half days', '${metrics.halfDays}'),
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
          InfoSection(title: 'Subjects', lines: [
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
                            [exam.subject, if (exam.examDate != null) _day.format(exam.examDate!)].where((part) => part.isNotEmpty).join(' · '),
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

class _FeesTab extends StatelessWidget {
  const _FeesTab({required this.student});

  final StudentDetail student;

  @override
  Widget build(BuildContext context) {
    final openLedger = OutlinedButton.icon(
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => StudentFeeLedgerScreen(studentId: student.id)),
      ),
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
      icon: const Icon(Icons.receipt_long_rounded, size: 18),
      label: const Text('Open Fee Ledger'),
    );

    if (student.feeAssignments.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.receipt_long_outlined,
          title: 'No fees assigned',
          message: 'Assign a fee structure on the web dashboard.',
        ),
      );
    }

    final total = student.feeAssignments.fold<double>(0, (sum, item) => sum + item.totalAmount);
    final paid = student.feeAssignments.fold<double>(0, (sum, item) => sum + item.paidAmount);
    final payments = [for (final assignment in student.feeAssignments) ...assignment.payments]
      ..sort((a, b) => (b.paidAt ?? DateTime(0)).compareTo(a.paidAt ?? DateTime(0)));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          phoneColumns: 3,
          wideColumns: 3,
          children: [
            KpiCard(index: 1, label: 'Total', value: formatInr(total), icon: Icons.receipt_long_rounded),
            KpiCard(index: 3, label: 'Paid', value: formatInr(paid), icon: Icons.check_circle_rounded),
            KpiCard(index: 2, label: 'Balance', value: formatInr(student.feeBalance), icon: Icons.pending_actions_rounded),
          ],
        ),
        const SizedBox(height: 12),
        openLedger,
        const SizedBox(height: 16),
        const SectionHeader(title: 'Fee Structures'),
        for (final assignment in student.feeAssignments)
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
                        Text(assignment.structureName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          'Paid ${formatInr(assignment.paidAmount, compact: false)} of ${formatInr(assignment.totalAmount, compact: false)}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  StatusChip(
                    label: humanizeConstant(assignment.status),
                    color: assignment.pendingAmount <= 0 ? AppColors.success : AppColors.warning,
                    tint: assignment.pendingAmount <= 0 ? AppColors.successSoft : AppColors.warningSoft,
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        const SectionHeader(title: 'Recent Payments'),
        if (payments.isEmpty)
          const AppCard(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: EmptyView(icon: Icons.payments_outlined, title: 'No payments yet'),
          )
        else
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(
              children: [
                for (var index = 0; index < payments.length; index++) ...[
                  if (index > 0) const Divider(),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                payments[index].paidAt == null ? '—' : _day.format(payments[index].paidAt!),
                                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                [
                                  humanizeConstant(payments[index].mode),
                                  if (payments[index].receiptNumber != null) 'Receipt ${payments[index].receiptNumber}',
                                ].join(' · '),
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          formatInr(payments[index].amount, compact: false),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _DocumentsTab extends StatelessWidget {
  const _DocumentsTab({required this.documents});

  final List<StudentDocument> documents;

  @override
  Widget build(BuildContext context) {
    if (documents.isEmpty) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: EmptyView(
          icon: Icons.folder_open_rounded,
          title: 'No documents',
          message: 'Upload documents from the web dashboard.',
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: Column(
        children: [
          for (var index = 0; index < documents.length; index++) ...[
            if (index > 0) const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined, color: AppColors.primary),
              title: Text(documents[index].name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: Text(
                [
                  humanizeConstant(documents[index].type),
                  if (documents[index].uploadedAt != null) _day.format(documents[index].uploadedAt!),
                ].join(' · '),
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
