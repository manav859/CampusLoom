/// The weekly timetable, shared by both apps: the principal reads a class's
/// week from GET /classes/:id/timetable, a teacher reads their own from
/// GET /users/me/schedule/week. The two payloads differ only in what sits
/// opposite the subject — a teacher's name, or a class's — so one model
/// carries both and [TimetableSlot.holderName] holds whichever it is.
library;

/// Minutes after midnight for an "HH:mm" bell time, or null when unset.
int? timeToMinutes(String? time) {
  final parts = time?.split(':');
  if (parts == null || parts.length != 2) return null;
  final hours = int.tryParse(parts[0]);
  final minutes = int.tryParse(parts[1]);
  return hours == null || minutes == null ? null : hours * 60 + minutes;
}

enum PeriodBadge { now, upcoming }

/// The blueprint's "Now" and "Upcoming" badges at [now]: the period in
/// progress, and the single next one to start. Untimed periods get neither.
/// The bell is validated to run in period order, so list order is time order.
List<PeriodBadge?> periodBadges(List<({int? start, int? end})> periods, DateTime now) {
  final minute = now.hour * 60 + now.minute;
  var upcomingGiven = false;

  return periods.map((period) {
    final start = period.start;
    final end = period.end;
    if (start == null || end == null) return null;
    if (start <= minute && minute < end) return PeriodBadge.now;
    if (!upcomingGiven && start > minute) {
      upcomingGiven = true;
      return PeriodBadge.upcoming;
    }
    return null;
  }).toList();
}

/// One period on one weekday. A free period has no subject and no holder; the
/// class payload sends those as nulls, the teacher payload omits the row.
class TimetableSlot {
  const TimetableSlot({
    required this.periodNumber,
    this.startTime,
    this.endTime,
    this.subjectName,
    this.holderName,
    this.contestedBy = 0,
  });

  final int periodNumber;
  final String? startTime;
  final String? endTime;
  final String? subjectName;

  /// The teacher taking the period (principal app) or the class being taught
  /// (teacher app).
  final String? holderName;

  /// How many further teachers hold this same slot. Always 0 in the teacher
  /// app; in the principal app it flags a class booked twice over.
  final int contestedBy;

  bool get isFree => subjectName == null && holderName == null;
  int? get startMinute => timeToMinutes(startTime);
  int? get endMinute => timeToMinutes(endTime);

  /// "08:00 – 08:40", or null until the principal sets the bell.
  String? get timeLabel =>
      startTime == null || endTime == null ? null : '$startTime – $endTime';

  factory TimetableSlot.fromClassJson(Map<String, dynamic> json) => TimetableSlot(
        periodNumber: (json['periodNumber'] as num).toInt(),
        startTime: json['startTime'] as String?,
        endTime: json['endTime'] as String?,
        subjectName: json['subjectName'] as String?,
        holderName: json['teacherName'] as String?,
        contestedBy: (json['contestedBy'] as num?)?.toInt() ?? 0,
      );

  factory TimetableSlot.fromTeacherJson(Map<String, dynamic> json) => TimetableSlot(
        periodNumber: (json['periodNumber'] as num).toInt(),
        startTime: json['startTime'] as String?,
        endTime: json['endTime'] as String?,
        subjectName: json['subjectName'] as String?,
        holderName: json['className'] as String?,
      );
}

class TimetableDay {
  const TimetableDay({required this.dayOfWeek, required this.label, required this.periods});

  final String dayOfWeek;
  final String label;
  final List<TimetableSlot> periods;

  /// Mon, Tue … for the day chips, which have to fit on a 320dp phone.
  String get shortLabel => label.length <= 3 ? label : label.substring(0, 3);

  int get taughtPeriods => periods.where((period) => !period.isFree).length;

  static TimetableDay _fromJson(
    Map<String, dynamic> json,
    TimetableSlot Function(Map<String, dynamic>) slot,
  ) =>
      TimetableDay(
        dayOfWeek: json['dayOfWeek'] as String? ?? '',
        label: json['label'] as String? ?? '',
        periods: ((json['periods'] as List?) ?? const [])
            .map((item) => slot((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class WeekTimetable {
  const WeekTimetable({required this.days, this.title});

  final List<TimetableDay> days;

  /// The class this week belongs to, e.g. "6-A". Null for a teacher's own week.
  final String? title;

  factory WeekTimetable.forClass(Map<String, dynamic> json) {
    final classJson = (json['class'] as Map?)?.cast<String, dynamic>();
    return WeekTimetable(
      title: classJson == null ? null : '${classJson['name']}-${classJson['section']}',
      days: _days(json, TimetableSlot.fromClassJson),
    );
  }

  factory WeekTimetable.forTeacher(Map<String, dynamic> json) =>
      WeekTimetable(days: _days(json, TimetableSlot.fromTeacherJson));

  static List<TimetableDay> _days(
    Map<String, dynamic> json,
    TimetableSlot Function(Map<String, dynamic>) slot,
  ) =>
      ((json['days'] as List?) ?? const [])
          .map((item) => TimetableDay._fromJson((item as Map).cast<String, dynamic>(), slot))
          .toList();

  int get taughtPeriods => days.fold(0, (total, day) => total + day.taughtPeriods);

  /// Which day the screen should open on: today, or Monday at the weekend.
  int indexOfToday(DateTime now) {
    final name = const [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ][now.weekday % 7];
    final index = days.indexWhere((day) => day.dayOfWeek == name);
    return index < 0 ? 0 : index;
  }
}
