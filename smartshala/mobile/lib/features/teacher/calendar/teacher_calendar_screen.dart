import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/school_calendar.dart';
import '../data/teacher_repository.dart';

/// The teacher's read-only school calendar, with their own punches for the
/// day in view above the school's events.
class TeacherCalendarScreen extends StatelessWidget {
  const TeacherCalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<TeacherRepository>();
    return SchoolCalendarScreen(
      loadMonth: repository.calendarMonth,
      loadActivity: repository.attendanceMonth,
    );
  }
}
