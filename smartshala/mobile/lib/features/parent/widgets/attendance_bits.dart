import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../data/parent_models.dart';

/// The accent colour for an attendance status, matching the KPI palette.
Color attendanceColor(AttendanceStatus status) => switch (status) {
      AttendanceStatus.present => AppColors.success,
      AttendanceStatus.absent => AppColors.danger,
      AttendanceStatus.leave => AppColors.warning,
      AttendanceStatus.unknown => AppColors.textMuted,
    };

Color attendanceSoft(AttendanceStatus status) => switch (status) {
      AttendanceStatus.present => AppColors.successSoft,
      AttendanceStatus.absent => AppColors.dangerSoft,
      AttendanceStatus.leave => AppColors.warningSoft,
      AttendanceStatus.unknown => AppColors.background,
    };

String attendanceLabel(AttendanceStatus status) => switch (status) {
      AttendanceStatus.present => 'Present',
      AttendanceStatus.absent => 'Absent',
      AttendanceStatus.leave => 'Leave',
      AttendanceStatus.unknown => 'Not marked',
    };

/// A donut showing an attendance percentage, with the figure in the middle.
class AttendanceRing extends StatelessWidget {
  const AttendanceRing({super.key, required this.percentage, this.size = 108});

  final double percentage;
  final double size;

  @override
  Widget build(BuildContext context) {
    final clamped = percentage.clamp(0, 100).toDouble();
    final color = clamped >= 75
        ? AppColors.success
        : clamped >= 50
            ? AppColors.warning
            : AppColors.danger;

    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RingPainter(percent: clamped / 100, color: color),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${clamped % 1 == 0 ? clamped.toStringAsFixed(0) : clamped.toStringAsFixed(1)}%',
                style: TextStyle(
                  fontSize: size * 0.22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.percent, required this.color});

  final double percent;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 10.0;
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (size.shortestSide - stroke) / 2;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = AppColors.border;
    canvas.drawCircle(center, radius, track);

    if (percent <= 0) return;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * percent,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.percent != percent || old.color != color;
}
