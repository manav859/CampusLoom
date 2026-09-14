import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/responsive.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';
import '../data/student_models.dart' show StudentCounts;
import '../data/teacher_models.dart' show TeacherCounts;
import '../widgets/management_widgets.dart';
import 'edit_school_profile_screen.dart';

class _SchoolData {
  const _SchoolData(this.profile, this.students, this.teachers, this.classes);

  final SchoolProfile profile;
  final StudentCounts? students;
  final TeacherCounts? teachers;
  final int? classes;
}

/// School Profile: the school's identity and contact details from Settings,
/// with quick stats and Edit School Profile. The logo is uploaded on the web.
class SchoolProfileScreen extends StatefulWidget {
  const SchoolProfileScreen({super.key});

  @override
  State<SchoolProfileScreen> createState() => _SchoolProfileScreenState();
}

class _SchoolProfileScreenState extends State<SchoolProfileScreen> {
  late Future<_SchoolData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_SchoolData> _load() async {
    final repository = context.read<PrincipalRepository>();
    // The stats are extras: a failure there leaves the tile blank, not the page.
    Future<T?> optional<T>(Future<T> future) => future.then<T?>((value) => value, onError: (Object _) => null);
    final results = await Future.wait<Object?>([
      repository.schoolProfile(),
      optional(repository.studentCounts()),
      optional(repository.teacherCounts()),
      optional(repository.classRows().then((rows) => rows.length)),
    ]);
    return _SchoolData(
      results[0]! as SchoolProfile,
      results[1] as StudentCounts?,
      results[2] as TeacherCounts?,
      results[3] as int?,
    );
  }

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _edit(SchoolProfile profile) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EditSchoolProfileScreen(profile: profile)),
    );
    if (saved != true || !mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(backgroundColor: AppColors.success, content: Text('School profile saved.')));
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_SchoolData>(
      future: _future,
      builder: (context, snapshot) {
        final data = snapshot.data;
        return Scaffold(
          appBar: AppBar(title: const Text('School Profile')),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load the school profile.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(onRefresh: _reload, child: _body(data!)),
          },
        );
      },
    );
  }

  Widget _body(_SchoolData data) {
    final profile = data.profile;
    final address = [profile.city, profile.state].whereType<String>().join(', ');

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        AppCard(
          child: Row(
            children: [
              SchoolLogo(logoUrl: profile.logoUrl, name: profile.name),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, height: 1.25)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusChip(label: profile.code, color: AppColors.primary, tint: AppColors.primarySoft),
                        const StatusChip(label: 'Active', color: AppColors.success, tint: AppColors.successSoft),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ManagementActionButton(
          icon: Icons.edit_rounded,
          label: 'Edit School Profile',
          primary: true,
          onTap: () => _edit(profile),
        ),
        const SizedBox(height: 18),
        const SectionHeader(title: 'Quick Stats'),
        ResponsiveGrid(
          phoneColumns: 3,
          wideColumns: 3,
          children: [
            KpiCard(index: 1, label: 'Students', value: data.students == null ? '—' : '${data.students!.active}', icon: Icons.school_rounded),
            KpiCard(index: 3, label: 'Teachers', value: data.teachers == null ? '—' : '${data.teachers!.active}', icon: Icons.badge_rounded),
            KpiCard(index: 4, label: 'Classes', value: data.classes == null ? '—' : '${data.classes}', icon: Icons.grid_view_rounded),
          ],
        ),
        const SizedBox(height: 18),
        InfoSection(title: 'Basic Information', lines: [
          ('School name', profile.name),
          ('School code', profile.code),
          ('Board', profile.affiliationBoard ?? 'Not set'),
          ('U-DISE number', profile.udiseNumber ?? 'Not set'),
          ('Periods per day', '${profile.timetablePeriodCount}'),
        ]),
        InfoSection(title: 'Contact', lines: [('Phone', profile.phone ?? 'Not set')]),
        InfoSection(title: 'Address', lines: [('City, State', address.isEmpty ? 'Not set' : address)]),
        const Text(
          'The logo and bell timings are changed in Settings on the web dashboard.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

/// The logo the web stores — usually a base64 data URL — or the school's
/// initial when there is none or it can't be read.
class SchoolLogo extends StatelessWidget {
  const SchoolLogo({super.key, required this.logoUrl, required this.name, this.size = 64});

  final String? logoUrl;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        name.isEmpty ? '?' : name.characters.first.toUpperCase(),
        style: TextStyle(fontSize: size * 0.4, fontWeight: FontWeight.w700, color: AppColors.primary),
      ),
    );
    final url = logoUrl;
    Widget? image;
    if (url != null && url.startsWith('data:image')) {
      final comma = url.indexOf(',');
      try {
        image = Image.memory(base64Decode(url.substring(comma + 1)), fit: BoxFit.contain, errorBuilder: (_, __, ___) => fallback);
      } on FormatException {
        image = null;
      }
    } else if (url != null && url.startsWith('http')) {
      image = Image.network(url, fit: BoxFit.contain, errorBuilder: (_, __, ___) => fallback);
    }

    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: image ?? fallback,
    );
  }
}
