import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/timetable_models.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/widgets/timetable_week.dart';
import '../data/teacher_repository.dart';

/// My Timetable: the whole week, where Home shows only today. Same layout as
/// the principal's class timetable, with the class opposite the subject
/// instead of the teacher.
class MyTimetableScreen extends StatefulWidget {
  const MyTimetableScreen({super.key});

  @override
  State<MyTimetableScreen> createState() => _MyTimetableScreenState();
}

class _MyTimetableScreenState extends State<MyTimetableScreen> {
  late Future<WeekTimetable> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<TeacherRepository>().weekTimetable();
  }

  Future<void> _reload() async {
    final future = context.read<TeacherRepository>().weekTimetable();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Timetable')),
      body: FutureBuilder<WeekTimetable>(
        future: _future,
        builder: (context, snapshot) {
          final week = snapshot.data;
          return switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) when week == null => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load your timetable.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  children: [
                    TimetableWeekView(
                      week: week!,
                      holderIcon: Icons.meeting_room_rounded,
                      emptyMessage: 'You have no periods that day.',
                    ),
                  ],
                ),
              ),
          };
        },
      ),
    );
  }
}
