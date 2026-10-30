import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum MessageDeliveryStatus { queued, sent, failed }

extension MessageDeliveryStatusX on MessageDeliveryStatus {
  String get label => switch (this) {
        MessageDeliveryStatus.queued => 'Queued',
        MessageDeliveryStatus.sent => 'Sent',
        MessageDeliveryStatus.failed => 'Failed',
      };

  Color get color => switch (this) {
        MessageDeliveryStatus.queued => AppColors.warning,
        MessageDeliveryStatus.sent => AppColors.success,
        MessageDeliveryStatus.failed => AppColors.danger,
      };

  Color get tint => switch (this) {
        MessageDeliveryStatus.queued => AppColors.warningSoft,
        MessageDeliveryStatus.sent => AppColors.successSoft,
        MessageDeliveryStatus.failed => AppColors.dangerSoft,
      };

  static MessageDeliveryStatus fromApi(String? value) => switch (value) {
        'SENT' => MessageDeliveryStatus.sent,
        'FAILED' => MessageDeliveryStatus.failed,
        _ => MessageDeliveryStatus.queued,
      };
}

/// One sent (or queued/failed) parent notification, as the web Message Logs
/// page lists it.
class MessageLog {
  const MessageLog({
    required this.id,
    required this.kindLabel,
    required this.recipientPhone,
    required this.message,
    required this.status,
    required this.createdAt,
    this.sentAt,
    this.studentName,
    this.sentByName,
  });

  final String id;
  final String kindLabel;
  final String recipientPhone;
  final String message;
  final MessageDeliveryStatus status;
  final DateTime createdAt;
  final DateTime? sentAt;
  final String? studentName;
  final String? sentByName;

  factory MessageLog.fromJson(Map<String, dynamic> json) {
    final student = (json['student'] as Map?)?.cast<String, dynamic>();
    final sentBy = (json['sentBy'] as Map?)?.cast<String, dynamic>();
    return MessageLog(
      id: json['id'] as String,
      kindLabel: _kindLabel(json['kind'] as String?),
      recipientPhone: json['recipientPhone'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: MessageDeliveryStatusX.fromApi(json['status'] as String?),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      sentAt: json['sentAt'] is String ? DateTime.tryParse(json['sentAt'] as String)?.toLocal() : null,
      studentName: student?['fullName'] as String?,
      sentByName: sentBy?['fullName'] as String?,
    );
  }

  static String _kindLabel(String? kind) => switch (kind) {
        'ABSENCE' => 'Absence',
        'LOW_ATTENDANCE' => 'Low attendance',
        'FEE_REMINDER' => 'Fee reminder',
        'OVERDUE_FEE' => 'Overdue fee',
        'PAYMENT_RECEIPT' => 'Payment receipt',
        'MONTHLY_REPORT' => 'Monthly report',
        _ => 'School alert',
      };
}
