import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum CalendarEventType { exam, holiday, event, meeting }

extension CalendarEventTypeX on CalendarEventType {
  String get label => switch (this) {
        CalendarEventType.exam => 'Exam',
        CalendarEventType.holiday => 'Holiday',
        CalendarEventType.event => 'Event',
        CalendarEventType.meeting => 'Meeting',
      };

  /// The legend filter names the whole category.
  String get pluralLabel => switch (this) {
        CalendarEventType.exam => 'Exams',
        CalendarEventType.holiday => 'Holidays',
        CalendarEventType.event => 'Events',
        CalendarEventType.meeting => 'Meetings',
      };

  IconData get icon => switch (this) {
        CalendarEventType.exam => Icons.edit_note_rounded,
        CalendarEventType.holiday => Icons.beach_access_rounded,
        CalendarEventType.event => Icons.celebration_rounded,
        CalendarEventType.meeting => Icons.groups_rounded,
      };

  Color get color => switch (this) {
        CalendarEventType.exam => AppColors.purple,
        CalendarEventType.holiday => AppColors.danger,
        CalendarEventType.event => AppColors.primary,
        CalendarEventType.meeting => AppColors.teal,
      };

  Color get tint => switch (this) {
        CalendarEventType.exam => AppColors.purpleSoft,
        CalendarEventType.holiday => AppColors.dangerSoft,
        CalendarEventType.event => AppColors.primarySoft,
        CalendarEventType.meeting => AppColors.tealSoft,
      };

  static CalendarEventType fromApi(String? value) => switch (value) {
        'EXAM' => CalendarEventType.exam,
        'HOLIDAY' => CalendarEventType.holiday,
        'MEETING' => CalendarEventType.meeting,
        _ => CalendarEventType.event,
      };
}

class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.type,
    required this.title,
    required this.startDate,
    required this.endDate,
    this.description,
  });

  final String id;
  final CalendarEventType type;
  final String title;
  final String? description;

  /// Local midnight of the first and last day, inclusive.
  final DateTime startDate;
  final DateTime endDate;

  bool get isMultiDay => endDate.isAfter(startDate);

  bool occursOn(DateTime day) {
    final date = DateTime(day.year, day.month, day.day);
    return !date.isBefore(startDate) && !date.isAfter(endDate);
  }

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    final startDate = _parseDay(json['startDate']);

    return CalendarEvent(
      id: json['id'] as String,
      type: CalendarEventTypeX.fromApi(json['type'] as String?),
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      startDate: startDate,
      endDate: json['endDate'] == null ? startDate : _parseDay(json['endDate']),
    );
  }
}

/// The server sends plain "2026-09-10" dates. Without a zone they parse as
/// local midnight, which is exactly a calendar day on any device.
DateTime _parseDay(Object? value) {
  final parsed = (value is String ? DateTime.tryParse(value) : null) ?? DateTime.now();
  return DateTime(parsed.year, parsed.month, parsed.day);
}
