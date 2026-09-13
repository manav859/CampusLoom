/// A recorded monthly pay slip from GET /payroll/me/slips. Amounts are rupees.
class SalarySlip {
  const SalarySlip({
    required this.id,
    required this.month,
    required this.basicPay,
    required this.allowances,
    required this.deductions,
    required this.netPay,
    required this.isPaid,
    this.paidOn,
    this.note,
  });

  final String id;

  /// "YYYY-MM".
  final String month;
  final double basicPay;
  final double allowances;
  final double deductions;
  final double netPay;
  final bool isPaid;

  /// "YYYY-MM-DD", only on paid slips.
  final String? paidOn;
  final String? note;

  DateTime get monthStart {
    final parts = month.split('-');
    return DateTime(int.parse(parts[0]), int.parse(parts[1]));
  }

  factory SalarySlip.fromJson(Map<String, dynamic> json) => SalarySlip(
        id: json['id'] as String,
        month: json['month'] as String,
        basicPay: (json['basicPay'] as num?)?.toDouble() ?? 0,
        allowances: (json['allowances'] as num?)?.toDouble() ?? 0,
        deductions: (json['deductions'] as num?)?.toDouble() ?? 0,
        netPay: (json['netPay'] as num?)?.toDouble() ?? 0,
        isPaid: json['status'] == 'PAID',
        paidOn: json['paidOn'] as String?,
        note: json['note'] as String?,
      );
}

class MySalary {
  const MySalary({required this.slips, required this.paidThisYear, required this.year});

  /// Newest month first.
  final List<SalarySlip> slips;
  final double paidThisYear;
  final int year;

  SalarySlip? get latest => slips.isEmpty ? null : slips.first;

  factory MySalary.fromJson(Map<String, dynamic> json) {
    final summary = (json['summary'] as Map?)?.cast<String, dynamic>() ?? const {};
    return MySalary(
      slips: ((json['items'] as List?) ?? const [])
          .map((item) => SalarySlip.fromJson((item as Map).cast<String, dynamic>()))
          .toList(),
      paidThisYear: (summary['paidThisYear'] as num?)?.toDouble() ?? 0,
      year: (summary['year'] as num?)?.toInt() ?? DateTime.now().year,
    );
  }
}
