/// One period of the school bell, as 24-hour "HH:mm" wall-clock times.
class PeriodTime {
  const PeriodTime({required this.periodNumber, this.startTime, this.endTime});

  final int periodNumber;
  final String? startTime;
  final String? endTime;

  bool get isComplete => (startTime?.isNotEmpty ?? false) && (endTime?.isNotEmpty ?? false);

  PeriodTime copyWith({String? startTime, String? endTime}) =>
      PeriodTime(periodNumber: periodNumber, startTime: startTime ?? this.startTime, endTime: endTime ?? this.endTime);

  factory PeriodTime.fromJson(Map<String, dynamic> json) => PeriodTime(
        periodNumber: (json['periodNumber'] as num).toInt(),
        startTime: json['startTime'] as String?,
        endTime: json['endTime'] as String?,
      );

  Map<String, dynamic> toJson() => {'periodNumber': periodNumber, 'startTime': startTime, 'endTime': endTime};
}

class PeriodTimes {
  const PeriodTimes({required this.periodCount, required this.periods});

  final int periodCount;
  final List<PeriodTime> periods;

  factory PeriodTimes.fromJson(Map<String, dynamic> json) => PeriodTimes(
        periodCount: (json['periodCount'] as num?)?.toInt() ?? 0,
        periods: ((json['periods'] as List?) ?? const [])
            .map((item) => PeriodTime.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );

  /// A row for every period 1..periodCount, filled in from whatever is saved so
  /// far, so the screen always shows the full day even before times are set.
  List<PeriodTime> get filledRows {
    final byNumber = {for (final period in periods) period.periodNumber: period};
    return [for (var n = 1; n <= periodCount; n++) byNumber[n] ?? PeriodTime(periodNumber: n)];
  }
}
