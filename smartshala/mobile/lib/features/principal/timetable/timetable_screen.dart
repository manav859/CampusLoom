import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/timetable_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/timetable_week.dart';
import '../data/principal_repository.dart';
import '../data/student_models.dart' show ClassChoice;
import '../widgets/management_widgets.dart';

/// Timetable: one class's week, read from the teacher period assignments the
/// web dashboard's grid writes. Assignment stays on the web — the phone is for
/// checking who is where, not for rebuilding a timetable.
class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  List<ClassChoice> _classes = const [];
  ClassChoice? _class;
  WeekTimetable? _week;
  bool _loading = true;
  String? _error;
  int _generation = 0;

  PrincipalRepository get _repository => context.read<PrincipalRepository>();

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final classes = await _repository.classes();
      if (!mounted) return;
      setState(() {
        _classes = classes;
        _class = classes.isEmpty ? null : classes.first;
      });
      if (_class == null) {
        setState(() => _loading = false);
      } else {
        await _load();
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _load() async {
    final classId = _class?.id;
    if (classId == null) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final week = await _repository.classTimetable(classId);
      if (!mounted || generation != _generation) return;
      setState(() {
        _week = week;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _pickClass() async {
    final picked = await pickFromSheet<ClassChoice?>(
      context,
      title: 'Class',
      options: [for (final item in _classes) (label: item.label, value: item)],
      selected: _class,
    );
    if (picked == null || picked.value == null || picked.value!.id == _class?.id) return;
    setState(() {
      _class = picked.value;
      _week = null;
    });
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final week = _week;

    return Scaffold(
      appBar: AppBar(title: const Text('Timetable')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            if (_classes.isNotEmpty) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: FilterChipButton(
                  label: _class?.label ?? 'Pick a class',
                  active: _class != null,
                  onTap: _pickClass,
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: LoadingView())
            else if (_error != null)
              ErrorView(message: _error!, onRetry: _classes.isEmpty ? _loadClasses : _load)
            else if (_classes.isEmpty)
              const AppCard(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: EmptyView(
                  icon: Icons.grid_view_rounded,
                  title: 'No classes yet',
                  message: 'Add a class first, then its periods appear here.',
                ),
              )
            else if (week != null) ...[
              TimetableWeekView(
                week: week,
                holderIcon: Icons.person_rounded,
                emptyMessage: 'No teacher has a period with this class that day.',
              ),
              const SizedBox(height: 14),
              const _AssignOnWebNote(),
            ],
          ],
        ),
      ),
    );
  }
}

/// The phone shows the timetable; the web grid is where it is built. Saying so
/// here saves a principal hunting for an edit button that is not coming.
class _AssignOnWebNote extends StatelessWidget {
  const _AssignOnWebNote();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Periods are assigned on the web dashboard, under Teachers. Bell times '
              'are set there too, in Settings.',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}
