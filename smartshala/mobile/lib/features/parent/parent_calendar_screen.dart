import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/month_calendar_view.dart';
import 'data/parent_repository.dart';

/// The Calendar tab: the school's events and holidays as a month grid the
/// parent can step through, the same view the teacher and principal apps show.
/// Read-only — events are set by the school.
class ParentCalendarScreen extends StatelessWidget {
  const ParentCalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MonthCalendarView(
      loadMonth: (month) => context.read<ParentRepository>().calendar(month),
    );
  }
}
