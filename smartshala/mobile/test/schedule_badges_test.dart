import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/teacher/data/teacher_models.dart';

SchedulePeriod _period(int number, String? start, String? end) => SchedulePeriod(
      periodNumber: number,
      className: '7-B',
      subjectName: 'Maths',
      startTime: start,
      endTime: end,
    );

/// Back-to-back 1 and 2, an untimed 3, and a 4 after a break.
final _day = [
  _period(1, '08:00', '08:45'),
  _period(2, '08:45', '09:30'),
  _period(3, null, null),
  _period(4, '10:30', '11:15'),
];

DateTime _at(int hour, int minute) => DateTime(2026, 9, 14, hour, minute);

void main() {
  test('before school the first period is upcoming and nothing is now', () {
    expect(scheduleBadges(_day, _at(7, 30)), [PeriodBadge.upcoming, null, null, null]);
  });

  test('during a period it is now and only the next timed one is upcoming', () {
    expect(scheduleBadges(_day, _at(8, 50)), [null, PeriodBadge.now, null, PeriodBadge.upcoming]);
  });

  test('at a changeover the starting period is now, not the finishing one', () {
    expect(scheduleBadges(_day, _at(8, 45)), [null, PeriodBadge.now, null, PeriodBadge.upcoming]);
  });

  test('in a break nothing is now and the next period is upcoming', () {
    expect(scheduleBadges(_day, _at(10, 0)), [null, null, null, PeriodBadge.upcoming]);
  });

  test('after the last period there are no badges', () {
    expect(scheduleBadges(_day, _at(12, 0)), [null, null, null, null]);
  });

  test('a school with no bell set never shows a badge', () {
    expect(scheduleBadges([_period(1, null, null)], _at(8, 10)), [null]);
  });

  test('reads times from the schedule endpoint', () {
    final timed = SchedulePeriod.fromJson({
      'periodNumber': 2,
      'className': '7-B',
      'subjectName': 'Maths',
      'startTime': '08:45',
      'endTime': '09:30',
    });
    expect(timed.startMinute, 8 * 60 + 45);
    expect(timed.endMinute, 9 * 60 + 30);

    final untimed = SchedulePeriod.fromJson({'periodNumber': 3, 'startTime': null, 'endTime': null});
    expect(untimed.startMinute, isNull);
    expect(untimed.endMinute, isNull);
  });
}
