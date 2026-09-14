import 'dart:math';

import '../../../core/data/dashboard_models.dart';

/// Fees for the principal app. Each piece ports the web fee pages
/// (frontend/src/app/(app)/fees/page.tsx, fees/[studentId], fees/defaulters and
/// components/fees/PaymentModal.tsx) so web and app agree on every figure.
/// Teachers never reach any of this: every /fees endpoint refuses their role.

double _money(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

int _int(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

DateTime? _date(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;

String _className(Object? value) {
  final json = (value as Map?)?.cast<String, dynamic>();
  return json == null ? 'Unassigned' : '${json['name']}-${json['section']}';
}

/// GET /fees/dashboard — the web "Collection Command Center" KPI cards.
class FeesOverview {
  const FeesOverview({
    required this.totalDue,
    required this.dueToDate,
    required this.totalCollected,
    required this.currentOutstanding,
    required this.totalPending,
    required this.defaulterCount,
    required this.topAccounts,
  });

  final double totalDue;
  final double dueToDate;
  final double totalCollected;
  final double currentOutstanding;
  final double totalPending;
  final int defaulterCount;

  /// The ten largest pending balances (web "Student Fee Accounts").
  final List<FeeAccount> topAccounts;

  factory FeesOverview.fromJson(Map<String, dynamic> json) => FeesOverview(
        totalDue: _money(json['totalDue']),
        dueToDate: _money(json['dueToDate']),
        totalCollected: _money(json['totalCollected']),
        currentOutstanding: _money(json['currentOutstanding']),
        totalPending: _money(json['totalPending']),
        defaulterCount: _int(json['defaulterCount']),
        topAccounts: ((json['topDefaulters'] as List?) ?? const [])
            .map((item) => FeeAccount.fromJson((item as Map).cast<String, dynamic>()))
            .toList(),
      );
}

/// One student fee assignment with a pending balance.
class FeeAccount {
  const FeeAccount({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.className,
    required this.structureName,
    required this.paid,
    required this.dueNow,
    required this.balance,
    required this.status,
  });

  final String id;
  final String studentId;
  final String studentName;
  final String className;
  final String structureName;
  final double paid;
  final double dueNow;
  final double balance;
  final String status;

  factory FeeAccount.fromJson(Map<String, dynamic> json) {
    final student = (json['student'] as Map?)?.cast<String, dynamic>() ?? const {};
    return FeeAccount(
      id: json['id'] as String? ?? '',
      studentId: json['studentId'] as String? ?? student['id'] as String? ?? '',
      studentName: student['fullName'] as String? ?? '—',
      className: _className(student['class']),
      structureName: ((json['feeStructure'] as Map?)?['name'] as String?) ?? 'Fee',
      paid: _money(json['paidAmount']),
      dueNow: _money(json['currentOutstanding']),
      balance: _money(json['pendingAmount']),
      status: json['status'] as String? ?? 'PENDING',
    );
  }
}

/// A fee plan from GET /fees/structures. Editing stays on the web.
class FeeStructureRow {
  const FeeStructureRow({
    required this.id,
    required this.name,
    required this.academicYear,
    required this.frequency,
    required this.totalAmount,
    required this.isActive,
    required this.classLabel,
    this.dueDate,
  });

  final String id;
  final String name;
  final String academicYear;
  final String frequency;
  final double totalAmount;
  final bool isActive;
  final String classLabel;
  final DateTime? dueDate;

  factory FeeStructureRow.fromJson(Map<String, dynamic> json) => FeeStructureRow(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        academicYear: json['academicYear'] as String? ?? '',
        frequency: json['frequency'] as String? ?? 'ANNUAL',
        totalAmount: _money(json['totalAmount']),
        isActive: json['isActive'] as bool? ?? true,
        classLabel: json['class'] == null ? 'All classes' : _className(json['class']),
        dueDate: _date(json['dueDate']),
      );
}

// ------------------------------------------------------------- defaulters

/// A row of GET /fees/defaulters, already sorted by the server.
class DefaulterRow {
  const DefaulterRow({
    required this.studentId,
    required this.name,
    required this.className,
    required this.balance,
    required this.daysOverdue,
    required this.status,
    this.feeStructure,
  });

  final String studentId;
  final String name;
  final String className;
  final String? feeStructure;
  final double balance;
  final int daysOverdue;
  final String status;

  factory DefaulterRow.fromJson(Map<String, dynamic> json) => DefaulterRow(
        studentId: json['studentId'] as String? ?? '',
        name: json['name'] as String? ?? '—',
        className: json['class'] as String? ?? '',
        feeStructure: json['feeStructure'] as String?,
        balance: _money(json['balance']),
        daysOverdue: _int(json['daysOverdue']),
        status: json['status'] as String? ?? 'PENDING',
      );
}

/// The web Collection Snapshot's aging buckets, by days overdue.
List<({String label, int value})> agingBuckets(List<DefaulterRow> rows) => [
      (label: '0-30', value: rows.where((row) => row.daysOverdue <= 30).length),
      (label: '31-60', value: rows.where((row) => row.daysOverdue > 30 && row.daysOverdue <= 60).length),
      (label: '61-90', value: rows.where((row) => row.daysOverdue > 60 && row.daysOverdue <= 90).length),
      (label: '90+', value: rows.where((row) => row.daysOverdue > 90).length),
    ];

enum DueAge {
  current('Not Overdue'),
  week('1-7 days'),
  month('8-30 days'),
  older('30+ days');

  const DueAge(this.label);

  final String label;

  bool matches(int days) => switch (this) {
        DueAge.current => days == 0,
        DueAge.week => days >= 1 && days <= 7,
        DueAge.month => days >= 8 && days <= 30,
        DueAge.older => days > 30,
      };
}

enum DefaulterSort {
  overdueDesc('Longest Overdue'),
  overdueAsc('Newest Due'),
  balanceDesc('Highest Balance'),
  balanceAsc('Lowest Balance'),
  nameAsc('Name A-Z');

  const DefaulterSort(this.label);

  final String label;
}

/// The web Defaulter Follow-up Queue's filters and sort, applied locally to
/// the full list as the web does.
List<DefaulterRow> filterDefaulters(
  List<DefaulterRow> rows, {
  String search = '',
  String? className,
  String? status,
  DueAge? dueAge,
  DefaulterSort sort = DefaulterSort.overdueDesc,
}) {
  final query = search.trim().toLowerCase();
  final filtered = rows.where((row) {
    final matchesSearch =
        query.isEmpty || row.name.toLowerCase().contains(query) || row.className.toLowerCase().contains(query);
    return matchesSearch &&
        (className == null || row.className == className) &&
        (status == null || row.status == status) &&
        (dueAge == null || dueAge.matches(row.daysOverdue));
  }).toList();

  filtered.sort((left, right) => switch (sort) {
        DefaulterSort.nameAsc => left.name.compareTo(right.name),
        DefaulterSort.balanceDesc => right.balance.compareTo(left.balance),
        DefaulterSort.balanceAsc => left.balance.compareTo(right.balance),
        DefaulterSort.overdueAsc => left.daysOverdue.compareTo(right.daysOverdue),
        DefaulterSort.overdueDesc => right.daysOverdue != left.daysOverdue
            ? right.daysOverdue.compareTo(left.daysOverdue)
            : right.balance.compareTo(left.balance),
      });
  return filtered;
}

/// The WhatsApp text the web defaulter queue sends, word for word.
String feeReminderMessage({required String studentName, required double balance}) =>
    'Dear Parent, fee balance of ${formatInr(balance, compact: false)} for $studentName is pending. '
    'Please clear it at the earliest.';

// ----------------------------------------------------------------- ledger

/// GET /fees/students/:id/ledger.
class FeeLedger {
  const FeeLedger({
    required this.studentId,
    required this.studentName,
    required this.admissionNumber,
    required this.className,
    required this.total,
    required this.paid,
    required this.balance,
    required this.dueToDate,
    required this.currentOutstanding,
    required this.currentCollected,
    required this.upcomingDue,
    required this.status,
    required this.assignments,
    required this.payments,
    required this.adjustments,
  });

  final String studentId;
  final String studentName;
  final String admissionNumber;
  final String className;
  final double total;
  final double paid;
  final double balance;
  final double dueToDate;
  final double currentOutstanding;
  final double currentCollected;
  final double upcomingDue;
  final String status;
  final List<LedgerAssignment> assignments;

  /// Newest first, each with the balance left after it.
  final List<LedgerPayment> payments;
  final List<LedgerAdjustment> adjustments;

  factory FeeLedger.fromJson(Map<String, dynamic> json) {
    final student = (json['student'] as Map?)?.cast<String, dynamic>() ?? const {};
    List<T> list<T>(String key, T Function(Map<String, dynamic>) parse) =>
        ((json[key] as List?) ?? const []).map((item) => parse((item as Map).cast<String, dynamic>())).toList();

    return FeeLedger(
      studentId: student['id'] as String? ?? '',
      studentName: student['fullName'] as String? ?? '—',
      admissionNumber: student['admissionNumber'] as String? ?? '',
      className: _className(student['class']),
      total: _money(json['total']),
      paid: _money(json['paid']),
      balance: _money(json['balance']),
      dueToDate: _money(json['dueToDate']),
      currentOutstanding: _money(json['currentOutstanding']),
      currentCollected: _money(json['currentCollected']),
      upcomingDue: _money(json['upcomingDue']),
      status: json['status'] as String? ?? 'PENDING',
      assignments: list('assignments', LedgerAssignment.fromJson),
      payments: list('payments', LedgerPayment.fromJson),
      adjustments: list('adjustments', LedgerAdjustment.fromJson),
    );
  }
}

class LedgerAssignment {
  const LedgerAssignment({
    required this.id,
    required this.structureName,
    required this.total,
    required this.paid,
    required this.balance,
    required this.transportFee,
    required this.status,
    this.dueDate,
  });

  final String id;
  final String structureName;
  final double total;
  final double paid;
  final double balance;
  final double transportFee;
  final String status;
  final DateTime? dueDate;

  /// The web shows base and transportation fee separately when both exist.
  double get baseFee => max(0, total - transportFee);

  factory LedgerAssignment.fromJson(Map<String, dynamic> json) {
    final structure = (json['feeStructure'] as Map?)?.cast<String, dynamic>() ?? const {};
    return LedgerAssignment(
      id: json['id'] as String? ?? '',
      structureName: structure['name'] as String? ?? 'Fee',
      dueDate: _date(structure['dueDate']),
      total: _money(json['total']),
      paid: _money(json['paid']),
      balance: _money(json['balance']),
      transportFee: _money(json['transportFeeAmount']),
      status: json['status'] as String? ?? 'PENDING',
    );
  }
}

class LedgerPayment {
  const LedgerPayment({
    required this.id,
    required this.amount,
    required this.mode,
    required this.isTransport,
    required this.balanceAfter,
    required this.structureName,
    this.paidAt,
    this.reference,
    this.receiptId,
    this.receiptNo,
  });

  final String id;
  final double amount;
  final String mode;
  final bool isTransport;
  final double balanceAfter;
  final String structureName;
  final DateTime? paidAt;
  final String? reference;
  final String? receiptId;
  final String? receiptNo;

  String get componentLabel => isTransport ? 'Transportation fee' : 'School fee';

  factory LedgerPayment.fromJson(Map<String, dynamic> json) {
    final receipt = (json['receipt'] as Map?)?.cast<String, dynamic>();
    return LedgerPayment(
      id: json['id'] as String? ?? '',
      amount: _money(json['amount']),
      mode: json['mode'] as String? ?? 'CASH',
      isTransport: json['feeComponent'] == 'TRANSPORTATION_FEE',
      balanceAfter: _money(json['balanceAfter']),
      structureName: json['feeStructureName'] as String? ?? 'Fee',
      paidAt: _date(json['paidAt'] ?? json['date']),
      reference: paymentReference(json),
      receiptId: json['receiptId'] as String? ?? receipt?['id'] as String?,
      receiptNo: json['receiptNo'] as String? ?? receipt?['receiptNo'] as String?,
    );
  }
}

class LedgerAdjustment {
  const LedgerAdjustment({
    required this.type,
    required this.amount,
    required this.reason,
    required this.structureName,
    this.createdAt,
    this.recordedBy,
  });

  final String type;
  final double amount;
  final String reason;
  final String structureName;
  final DateTime? createdAt;
  final String? recordedBy;

  factory LedgerAdjustment.fromJson(Map<String, dynamic> json) => LedgerAdjustment(
        type: json['type'] as String? ?? 'CONCESSION',
        amount: _money(json['amount']),
        reason: json['reason'] as String? ?? '',
        structureName: json['feeStructureName'] as String? ?? 'Fee',
        createdAt: _date(json['createdAt']),
        recordedBy: (json['recordedBy'] as Map?)?['fullName'] as String?,
      );
}

/// The first reference a payment carries, in the web's order.
String? paymentReference(Map<String, dynamic> json) => [
      json['upiTransactionId'],
      json['chequeNumber'],
      json['ddNumber'],
      json['bankReference'],
      json['gatewayTransactionId'],
    ].whereType<String>().where((value) => value.isNotEmpty).firstOrNull;

// ---------------------------------------------------------------- payment

/// The payment modes the server accepts, with the reference each one needs.
enum PaymentMode {
  cash('CASH', 'Cash', null, null),
  upi('UPI', 'UPI', 'upiTransactionId', 'UPI Transaction ID'),
  cheque('CHEQUE', 'Cheque', 'chequeNumber', 'Cheque Number'),
  dd('DD', 'DD', 'ddNumber', 'DD Number'),
  bankTransfer('BANK_TRANSFER', 'Bank Transfer', 'bankReference', 'Bank Reference'),
  onlineGateway('ONLINE_GATEWAY', 'Online Gateway', 'gatewayTransactionId', 'Gateway Transaction ID'),
  other('OTHER', 'Other', null, null);

  const PaymentMode(this.apiValue, this.label, this.referenceField, this.referenceLabel);

  final String apiValue;
  final String label;

  /// The body field holding the reference, when this mode requires one.
  final String? referenceField;
  final String? referenceLabel;
}

class NewPayment {
  const NewPayment({
    required this.studentId,
    required this.amount,
    required this.mode,
    required this.paidOn,
    this.isTransport = false,
    this.reference,
    this.sendReceiptOnWhatsApp = true,
  });

  final String studentId;
  final double amount;
  final PaymentMode mode;
  final DateTime paidOn;
  final bool isTransport;
  final String? reference;
  final bool sendReceiptOnWhatsApp;

  /// The body the web PaymentModal posts: the date as YYYY-MM-DD, and the
  /// reference only under the field its mode names.
  Map<String, dynamic> toJson() {
    final day = '${paidOn.year}-${paidOn.month.toString().padLeft(2, '0')}-${paidOn.day.toString().padLeft(2, '0')}';
    return {
      'studentId': studentId,
      'amount': amount,
      'feeComponent': isTransport ? 'TRANSPORTATION_FEE' : 'SCHOOL_FEE',
      'mode': mode.apiValue,
      'paidAt': day,
      'sendReceiptOnWhatsApp': sendReceiptOnWhatsApp,
      if (mode.referenceField != null) mode.referenceField!: reference?.trim(),
    };
  }
}

/// Why a payment can't be posted yet, in the web modal's words; null when it can.
String? validatePayment({required double? amount, required double balance, required PaymentMode mode, String? reference}) {
  if (amount == null || amount <= 0) return 'Enter an amount greater than zero.';
  if (amount > balance) return 'Amount cannot exceed ${formatInr(balance, compact: false)}.';
  if (mode.referenceLabel != null && (reference?.trim().isEmpty ?? true)) {
    return '${mode.referenceLabel} is required for ${mode.label} payments.';
  }
  return null;
}

/// POST /fees/payments.
class PaymentReceipt {
  const PaymentReceipt({
    required this.receiptId,
    required this.receiptNo,
    required this.amount,
    required this.balance,
    required this.paid,
    required this.status,
    required this.whatsAppQueued,
  });

  final String receiptId;
  final String receiptNo;
  final double amount;
  final double balance;
  final double paid;
  final String status;
  final bool whatsAppQueued;

  factory PaymentReceipt.fromJson(Map<String, dynamic> json) {
    final receipt = (json['receipt'] as Map?)?.cast<String, dynamic>() ?? const {};
    final ledger = (json['ledger'] as Map?)?.cast<String, dynamic>() ?? const {};
    return PaymentReceipt(
      receiptId: receipt['id'] as String? ?? '',
      receiptNo: receipt['receiptNo'] as String? ?? '',
      amount: _money((json['payment'] as Map?)?['amount']),
      balance: _money(ledger['balance']),
      paid: _money(ledger['paid']),
      status: ledger['status'] as String? ?? '',
      whatsAppQueued: json['receiptNotificationQueued'] as bool? ?? false,
    );
  }
}

/// A random v4 UUID for the Idempotency-Key header. A payment form keeps one
/// key for its lifetime, so a retry — a double tap, or the client replaying
/// the request after refreshing an expired token — records the payment once.
String newIdempotencyKey([Random? random]) {
  final source = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => source.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}
