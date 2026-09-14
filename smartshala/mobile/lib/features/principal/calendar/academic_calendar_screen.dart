import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/data/calendar_models.dart';
import '../../../core/widgets/school_calendar.dart';
import '../data/principal_repository.dart';
import 'event_form_screen.dart';

/// The principal's Academic Calendar: the teacher's month view plus Add New
/// Event, and tapping an event to edit or delete it. Holidays come from
/// Attendance and are not edited here.
class AcademicCalendarScreen extends StatelessWidget {
  const AcademicCalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<PrincipalRepository>();

    Future<bool> open(Widget screen) async =>
        await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => screen)) ?? false;

    return SchoolCalendarScreen(
      title: 'Academic Calendar',
      loadMonth: repository.calendarMonth,
      onAddEvent: (day) => open(EventFormScreen(initialDate: day)),
      onEventTap: (event) async {
        if (event.type == CalendarEventType.holiday) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(const SnackBar(content: Text('Holidays are managed in Attendance on the web dashboard.')));
          return false;
        }
        return open(EventFormScreen(event: event));
      },
    );
  }
}
