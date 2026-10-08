import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

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
    this.startTime,
    this.endTime,
  });

  final String id;
  final CalendarEventType type;
  final String title;
  final String? description;

  /// Local midnight of the first and last day, inclusive.
  final DateTime startDate;
  final DateTime endDate;

  /// Wall-clock "HH:mm" on the start and end days; null for an all-day event.
  final String? startTime;
  final String? endTime;

  bool get isMultiDay => endDate.isAfter(startDate);

  bool get isAllDay => startTime == null;

  /// "10:00 AM – 12:30 PM", "10:00 AM", or null for an all-day event.
  String? get timeLabel {
    final start = formatEventTime(startTime);
    if (start == null) return null;
    final end = formatEventTime(endTime);
    return end == null ? start : '$start – $end';
  }

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
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
    );
  }
}

/// "14:30" → "2:30 PM"; null, or anything that is not a time, stays null.
String? formatEventTime(String? value) {
  final parts = value?.split(':');
  if (parts == null || parts.length != 2) return null;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return null;
  final twelve = hour % 12 == 0 ? 12 : hour % 12;
  return '$twelve:${minute.toString().padLeft(2, '0')} ${hour < 12 ? 'AM' : 'PM'}';
}

/// The server sends plain "2026-09-10" dates. Without a zone they parse as
/// local midnight, which is exactly a calendar day on any device.
DateTime _parseDay(Object? value) {
  final parsed = (value is String ? DateTime.tryParse(value) : null) ?? DateTime.now();
  return DateTime(parsed.year, parsed.month, parsed.day);
}

/// The body of POST and PATCH /calendar/events. Holidays are not a calendar
/// type: they lock attendance, so they are still made in Attendance.
class CalendarEventDraft {
  const CalendarEventDraft({
    required this.type,
    required this.title,
    required this.startDate,
    required this.endDate,
    this.description,
    this.startTime,
    this.endTime,
  });

  static const editableTypes = [CalendarEventType.exam, CalendarEventType.event, CalendarEventType.meeting];

  final CalendarEventType type;
  final String title;
  final String? description;
  final DateTime startDate;
  final DateTime endDate;

  /// Both null for an all-day event.
  final TimeOfDay? startTime;
  final TimeOfDay? endTime;

  static String? _time(TimeOfDay? time) =>
      time == null ? null : '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  static String _day(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Map<String, dynamic> toJson() => {
        'type': switch (type) {
          CalendarEventType.exam => 'EXAM',
          CalendarEventType.meeting => 'MEETING',
          _ => 'EVENT',
        },
        'title': title.trim(),
        if (description != null && description!.trim().isNotEmpty) 'description': description!.trim(),
        'startDate': _day(startDate),
        'endDate': _day(endDate),
        // Sent as null too, so editing an event back to all-day clears its time.
        'startTime': _time(startTime),
        'endTime': startTime == null ? null : _time(endTime),
      };
}
