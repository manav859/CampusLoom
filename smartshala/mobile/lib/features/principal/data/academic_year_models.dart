import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum AcademicYearStatus { upcoming, active, closed }

extension AcademicYearStatusX on AcademicYearStatus {
  String get label => switch (this) {
        AcademicYearStatus.upcoming => 'Upcoming',
        AcademicYearStatus.active => 'Active',
        AcademicYearStatus.closed => 'Closed',
      };

  Color get color => switch (this) {
        AcademicYearStatus.upcoming => AppColors.warning,
        AcademicYearStatus.active => AppColors.success,
        AcademicYearStatus.closed => AppColors.textSecondary,
      };

  Color get tint => switch (this) {
        AcademicYearStatus.upcoming => AppColors.warningSoft,
        AcademicYearStatus.active => AppColors.successSoft,
        AcademicYearStatus.closed => AppColors.background,
      };

  static AcademicYearStatus fromApi(String? value) => switch (value) {
        'ACTIVE' => AcademicYearStatus.active,
        'CLOSED' => AcademicYearStatus.closed,
        _ => AcademicYearStatus.upcoming,
      };
}

class AcademicYear {
  const AcademicYear({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.isCurrent,
    required this.status,
    required this.classCount,
  });

  final String id;
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  final bool isCurrent;
  final AcademicYearStatus status;
  final int classCount;

  factory AcademicYear.fromJson(Map<String, dynamic> json) => AcademicYear(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        startDate: DateTime.tryParse(json['startDate'] as String? ?? '')?.toUtc() ?? DateTime.now(),
        endDate: DateTime.tryParse(json['endDate'] as String? ?? '')?.toUtc() ?? DateTime.now(),
        isCurrent: json['isCurrent'] as bool? ?? false,
        status: AcademicYearStatusX.fromApi(json['status'] as String?),
        classCount: ((json['_count'] as Map?)?['classes'] as num?)?.toInt() ?? 0,
      );
}
