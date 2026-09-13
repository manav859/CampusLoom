import 'package:flutter/material.dart';

/// The web dashboard's design tokens (frontend/src/app/globals.css), so the
/// apps and the web read as one product. Change a colour there and here together.
class AppColors {
  // --brand-primary / -hover / --info-100
  static const primary = Color(0xFF2456E6);
  static const primaryDark = Color(0xFF1B45BD);
  static const primarySoft = Color(0xFFE2EAFD);

  // --surface-50, white cards, --border-200
  static const background = Color(0xFFF7F8FB);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFDCE1E8);

  // --ink-900 / --ink-500 / the web's tertiary grey
  static const textPrimary = Color(0xFF0F1419);
  static const textSecondary = Color(0xFF5A6573);
  static const textMuted = Color(0xFF86868B);

  // --success-600/100, --danger-600/100, --warning-600/100
  static const success = Color(0xFF0F8A4A);
  static const successSoft = Color(0xFFE1F5EA);
  static const danger = Color(0xFFC8242C);
  static const dangerSoft = Color(0xFFFCE3E5);
  static const warning = Color(0xFFB95A00);
  static const warningSoft = Color(0xFFFFF2DC);
  static const purple = Color(0xFF7C3AED);
  static const purpleSoft = Color(0xFFF1EBFE);
  static const teal = Color(0xFF0D9488);
  static const tealSoft = Color(0xFFE3F5F3);

  /// The web dashboard's KPI card grounds and icon colours, in the order the
  /// web cycles through them (DashboardHome `dashboardKpiStyles`).
  static const kpiStyles = [
    (ground: Color(0xFFF1E4FF), icon: Color(0xFFA96BF4)),
    (ground: Color(0xFFE5F7FF), icon: Color(0xFF67C3F4)),
    (ground: Color(0xFFFFF0E8), icon: Color(0xFFFF9867)),
    (ground: Color(0xFFEAF9EB), icon: Color(0xFF55C979)),
    (ground: Color(0xFFF0E8FF), icon: Color(0xFF8B6CF6)),
  ];

  static const kpiLabel = Color(0xFF6F7480);
  static const kpiValue = Color(0xFF111827);
}

/// The web's radii: --radius-md for controls, --radius-lg for cards.
class AppRadii {
  static const control = 6.0;
  static const card = 8.0;
  static const sheet = 16.0;
}
