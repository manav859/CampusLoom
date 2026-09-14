import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/school_calendar.dart';
import '../data/teacher_repository.dart';

/// The teacher's read-only school calendar.
class TeacherCalendarScreen extends StatelessWidget {
  const TeacherCalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SchoolCalendarScreen(loadMonth: context.read<TeacherRepository>().calendarMonth);
  }
}
