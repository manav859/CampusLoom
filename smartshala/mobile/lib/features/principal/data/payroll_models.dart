import 'package:flutter/material.dart';

import '../../../core/data/calendar_models.dart' show formatEventTime;

/// A working shift: the hours a staff member is expected in. Payroll measures
/// each day's punched time against it.
class StaffShift {
  const StaffShift({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.minutes,
    this.staffCount = 0,
  });

  final String id;
  final String name;

  /// Wall-clock "HH:mm".
  final String startTime;
  final String endTime;

  /// Shift length; a shift past midnight wraps.
  final int minutes;
  final int staffCount;

  String get timeLabel => '${formatEventTime(startTime)} – ${formatEventTime(endTime)}';

  String get lengthLabel {
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0 ? '${hours}h' : '${hours}h ${rest}m';
  }

  factory StaffShift.fromJson(Map<String, dynamic> json) => StaffShift(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        startTime: json['startTime'] as String? ?? '09:00',
        endTime: json['endTime'] as String? ?? '15:00',
        minutes: (json['minutes'] as num?)?.toInt() ?? 0,
        staffCount: (json['staffCount'] as num?)?.toInt() ?? 0,
      );
}

/// The body of POST and PATCH /payroll/shifts.
class ShiftDraft {
  const ShiftDraft({required this.name, required this.start, required this.end});

  final String name;
  final TimeOfDay start;
  final TimeOfDay end;

  static String _hhmm(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  Map<String, dynamic> toJson() => {'name': name.trim(), 'startTime': _hhmm(start), 'endTime': _hhmm(end)};
}

/// How each working day of the month counted for one staff member.
class PayrollDays {
  const PayrollDays({
    this.full = 0,
    this.half = 0,
    this.leave = 0,
    this.unpaidLeave = 0,
    this.absent = 0,
    this.beforeJoining = 0,
    this.upcoming = 0,
    this.missingPunchOut = 0,
  });

  final int full;
  final int half;
  final int leave;
  final int unpaidLeave;
  final int absent;
  final int beforeJoining;

  /// Days still ahead in the current month: not deducted.
  final int upcoming;

  /// Days punched in but never punched out: counted in full, worth a word.
  final int missingPunchOut;

  static int _int(Object? value) => (value as num?)?.toInt() ?? 0;

  factory PayrollDays.fromJson(Map<String, dynamic> json) => PayrollDays(
        full: _int(json['full']),
        half: _int(json['half']),
        leave: _int(json['leave']),
        unpaidLeave: _int(json['unpaidLeave']),
        absent: _int(json['absent']),
        beforeJoining: _int(json['beforeJoining']),
        upcoming: _int(json['upcoming']),
        missingPunchOut: _int(json['missingPunchOut']),
      );
}

enum PayslipState { none, pending, paid }

/// One staff member's month: their pay setup and the pay it works out to.
class PayrollRow {
  const PayrollRow({
    required this.userId,
    required this.fullName,
    required this.role,
    required this.days,
    required this.canEdit,
    this.shift,
    this.monthlySalary,
    this.dayRate = 0,
    this.deductionDays = 0,
    this.calculatedPay,
    this.slip = PayslipState.none,
    this.slipNetPay,
  });

  final String userId;
  final String fullName;
  final String role;
  final StaffShift? shift;

  /// Null until the principal sets a salary.
  final double? monthlySalary;
  final double dayRate;
  final double deductionDays;
  final double? calculatedPay;
  final PayrollDays days;
  final PayslipState slip;
  final double? slipNetPay;

  /// False on the principal's own row: nobody sets their own pay.
  final bool canEdit;

  String get roleLabel => switch (role) {
        'PRINCIPAL' => 'Principal',
        'ADMIN' => 'Admin',
        'ACCOUNTANT' => 'Accountant',
        _ => 'Teacher',
      };

  static double? _double(Object? value) => (value as num?)?.toDouble();

  factory PayrollRow.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    final slip = json['slip'] as Map<String, dynamic>?;
    final shift = json['shift'] as Map<String, dynamic>?;
    return PayrollRow(
      userId: user['id'] as String? ?? '',
      fullName: user['fullName'] as String? ?? '',
      role: user['role'] as String? ?? 'TEACHER',
      shift: shift == null ? null : StaffShift.fromJson(shift),
      monthlySalary: _double(json['monthlySalary']),
      dayRate: _double(json['dayRate']) ?? 0,
      deductionDays: _double(json['deductionDays']) ?? 0,
      calculatedPay: _double(json['calculatedPay']),
      days: PayrollDays.fromJson(json['days'] as Map<String, dynamic>? ?? const {}),
      slip: switch (slip?['status']) {
        'PAID' => PayslipState.paid,
        'PENDING' => PayslipState.pending,
        _ => PayslipState.none,
      },
      slipNetPay: _double(slip?['netPay']),
      canEdit: json['canEdit'] as bool? ?? false,
    );
  }
}

/// GET /payroll/calculate: the month, its working days and every row.
class PayrollMonth {
  const PayrollMonth({
    required this.month,
    required this.workingDays,
    required this.fullDayShare,
    required this.rows,
    required this.totalCalculated,
  });

  final String month;
  final int workingDays;

  /// The share of a shift that earns a full day; below it, half a day.
  final double fullDayShare;
  final List<PayrollRow> rows;
  final double totalCalculated;

  factory PayrollMonth.fromJson(Map<String, dynamic> json) => PayrollMonth(
        month: json['month'] as String? ?? '',
        workingDays: (json['workingDays'] as num?)?.toInt() ?? 0,
        fullDayShare: (json['fullDayShare'] as num?)?.toDouble() ?? 0.75,
        rows: [
          for (final row in (json['items'] as List<dynamic>? ?? const [])) PayrollRow.fromJson(row as Map<String, dynamic>),
        ],
        totalCalculated: ((json['summary'] as Map<String, dynamic>?)?['totalCalculated'] as num?)?.toDouble() ?? 0,
      );
}

/// What POST /payroll/generate did.
class GenerateResult {
  const GenerateResult({required this.generated, required this.skippedPaid, required this.skippedNoSalary});

  final int generated;
  final int skippedPaid;
  final int skippedNoSalary;

  factory GenerateResult.fromJson(Map<String, dynamic> json) => GenerateResult(
        generated: (json['generated'] as num?)?.toInt() ?? 0,
        skippedPaid: (json['skippedPaid'] as num?)?.toInt() ?? 0,
        skippedNoSalary: (json['skippedNoSalary'] as num?)?.toInt() ?? 0,
      );
}
