import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/data/timetable_models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/state_views.dart';
import '../../core/widgets/timetable_week.dart';
import 'data/parent_repository.dart';

/// A child's weekly class timetable: the day chips over that day's periods,
/// the same view the principal and teacher apps show. The teacher taking each
/// period sits opposite the subject, so a parent knows who to ask about it.
/// Read-only — the timetable is built on the web dashboard.
class ParentTimetableScreen extends StatefulWidget {
  const ParentTimetableScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentTimetableScreen> createState() => _ParentTimetableScreenState();
}

class _ParentTimetableScreenState extends State<ParentTimetableScreen> {
  WeekTimetable? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ParentRepository>().timetable(widget.childId);
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

  @override
  Widget build(BuildContext context) {
    final week = _data;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Class Timetable'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              week?.title == null ? widget.childName : '${widget.childName} · ${week!.title}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                      children: [
                        TimetableWeekView(
                          week: week!,
                          holderIcon: Icons.person_outline_rounded,
                          emptyMessage: 'No periods are scheduled that day.',
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }
}
