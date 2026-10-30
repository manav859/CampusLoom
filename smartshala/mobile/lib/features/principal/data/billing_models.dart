import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum SubscriptionStatus { trialing, active, pastDue, cancelled, expired }

extension SubscriptionStatusX on SubscriptionStatus {
  String get label => switch (this) {
        SubscriptionStatus.trialing => 'Trial',
        SubscriptionStatus.active => 'Active',
        SubscriptionStatus.pastDue => 'Payment due',
        SubscriptionStatus.cancelled => 'Cancelled',
        SubscriptionStatus.expired => 'Expired',
      };

  Color get color => switch (this) {
        SubscriptionStatus.trialing => AppColors.primary,
        SubscriptionStatus.active => AppColors.success,
        SubscriptionStatus.pastDue => AppColors.warning,
        SubscriptionStatus.cancelled => AppColors.textSecondary,
        SubscriptionStatus.expired => AppColors.danger,
      };

  Color get tint => switch (this) {
        SubscriptionStatus.trialing => AppColors.primarySoft,
        SubscriptionStatus.active => AppColors.successSoft,
        SubscriptionStatus.pastDue => AppColors.warningSoft,
        SubscriptionStatus.cancelled => AppColors.background,
        SubscriptionStatus.expired => AppColors.dangerSoft,
      };

  static SubscriptionStatus fromApi(String? value) => switch (value) {
        'TRIALING' => SubscriptionStatus.trialing,
        'ACTIVE' => SubscriptionStatus.active,
        'PAST_DUE' => SubscriptionStatus.pastDue,
        'CANCELLED' => SubscriptionStatus.cancelled,
        _ => SubscriptionStatus.expired,
      };
}

enum InvoiceStatus { draft, due, paid, voided, refunded }

extension InvoiceStatusX on InvoiceStatus {
  String get label => switch (this) {
        InvoiceStatus.draft => 'Draft',
        InvoiceStatus.due => 'Due',
        InvoiceStatus.paid => 'Paid',
        InvoiceStatus.voided => 'Void',
        InvoiceStatus.refunded => 'Refunded',
      };

  Color get color => switch (this) {
        InvoiceStatus.paid => AppColors.success,
        InvoiceStatus.due => AppColors.warning,
        InvoiceStatus.refunded => AppColors.primary,
        _ => AppColors.textSecondary,
      };

  Color get tint => switch (this) {
        InvoiceStatus.paid => AppColors.successSoft,
        InvoiceStatus.due => AppColors.warningSoft,
        InvoiceStatus.refunded => AppColors.primarySoft,
        _ => AppColors.background,
      };

  static InvoiceStatus fromApi(String? value) => switch (value) {
        'DRAFT' => InvoiceStatus.draft,
        'DUE' => InvoiceStatus.due,
        'PAID' => InvoiceStatus.paid,
        'REFUNDED' => InvoiceStatus.refunded,
        _ => InvoiceStatus.voided,
      };
}

class BillingInvoice {
  const BillingInvoice({
    required this.number,
    required this.planName,
    required this.status,
    required this.totalMinor,
    required this.currency,
    required this.issuedAt,
    this.paidAt,
  });

  final String number;
  final String planName;
  final InvoiceStatus status;
  final int totalMinor;
  final String currency;
  final DateTime? issuedAt;
  final DateTime? paidAt;

  factory BillingInvoice.fromJson(Map<String, dynamic> json) => BillingInvoice(
        number: json['number'] as String? ?? '',
        planName: json['planName'] as String? ?? '',
        status: InvoiceStatusX.fromApi(json['status'] as String?),
        totalMinor: (json['totalMinor'] as num?)?.toInt() ?? 0,
        currency: json['currency'] as String? ?? 'INR',
        issuedAt: _date(json['issuedAt']),
        paidAt: _date(json['paidAt']),
      );
}

class BillingOverview {
  const BillingOverview({
    required this.status,
    required this.planName,
    required this.daysRemaining,
    required this.periodEnd,
    required this.cancelAtPeriodEnd,
    required this.priceMinor,
    required this.currency,
    required this.interval,
    required this.intervalCount,
    required this.students,
    required this.staff,
    required this.maxStudents,
    required this.maxStaff,
    required this.invoices,
    required this.paidTotalMinor,
  });

  final SubscriptionStatus status;
  final String planName;
  final int daysRemaining;
  final DateTime? periodEnd;
  final bool cancelAtPeriodEnd;
  final int priceMinor;
  final String currency;
  final String interval; // "MONTH" | "YEAR"
  final int intervalCount;
  final int students;
  final int staff;
  final int? maxStudents;
  final int? maxStaff;
  final List<BillingInvoice> invoices;
  final int paidTotalMinor;

  String get intervalLabel {
    final unit = interval == 'MONTH' ? 'month' : 'year';
    return intervalCount == 1 ? 'per $unit' : 'per $intervalCount ${unit}s';
  }

  factory BillingOverview.fromJson(Map<String, dynamic> json) {
    final subscription = (json['subscription'] as Map?)?.cast<String, dynamic>() ?? const {};
    final plan = (json['plan'] as Map?)?.cast<String, dynamic>() ?? const {};
    final pricing = (json['pricing'] as Map?)?.cast<String, dynamic>() ?? const {};
    final usage = (json['usage'] as Map?)?.cast<String, dynamic>() ?? const {};
    final totals = (json['totals'] as Map?)?.cast<String, dynamic>() ?? const {};

    return BillingOverview(
      status: SubscriptionStatusX.fromApi(subscription['status'] as String?),
      planName: plan['name'] as String? ?? 'Plan',
      daysRemaining: (subscription['daysRemaining'] as num?)?.toInt() ?? 0,
      periodEnd: _date(subscription['currentPeriodEnd']),
      cancelAtPeriodEnd: subscription['cancelAtPeriodEnd'] as bool? ?? false,
      priceMinor: (pricing['effectivePriceMinor'] as num?)?.toInt() ?? (plan['priceMinor'] as num?)?.toInt() ?? 0,
      currency: plan['currency'] as String? ?? 'INR',
      interval: plan['interval'] as String? ?? 'MONTH',
      intervalCount: (plan['intervalCount'] as num?)?.toInt() ?? 1,
      students: (usage['students'] as num?)?.toInt() ?? 0,
      staff: (usage['staff'] as num?)?.toInt() ?? 0,
      maxStudents: (usage['maxStudents'] as num?)?.toInt(),
      maxStaff: (usage['maxStaff'] as num?)?.toInt(),
      invoices: ((json['invoices'] as List?) ?? const [])
          .map((item) => BillingInvoice.fromJson((item as Map).cast<String, dynamic>()))
          .toList(),
      paidTotalMinor: (totals['paidMinor'] as num?)?.toInt() ?? 0,
    );
  }
}

DateTime? _date(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;
