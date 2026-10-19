import 'package:flutter/material.dart';

/// The brand and status colours the web dashboard uses (frontend/src/app/
/// globals.css), so the apps and the web read as one product. Change a colour
/// there and here together. The surfaces those colours sit on are the phone's
/// own — a white page and softly shadowed cards — and live in [Home] below.
class AppColors {
  // --brand-primary / -hover / --info-100
  static const primary = Color(0xFF2456E6);
  static const primaryDark = Color(0xFF1B45BD);
  static const primarySoft = Color(0xFFE2EAFD);

  // --surface-50 (a neutral tint, not the page: the page is white), white
  // cards, and the hairline a card is drawn on.
  static const background = Color(0xFFF7F8FB);
  static const surface = Color(0xFFFFFFFF);
  static const border = Home.line;

  /// A field has to show its edge without a card's shadow to help it, so it
  /// keeps the firmer line the rest of the app has given up.
  static const inputBorder = Color(0xFFDCE1E8);

  // The Home screens' ink, now both apps': a deep navy that reads warmer
  // than the web's near-black on a white page.
  static const textPrimary = Home.ink;
  static const textSecondary = Home.inkSoft;
  static const textMuted = Home.inkMuted;

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

  static const kpiLabel = Home.inkSoft;
  static const kpiValue = Home.ink;
}

/// The radii both apps round to — the Home screens' shapes.
class AppRadii {
  static const control = 10.0;
  static const card = Home.cardRadius;
  static const sheet = 16.0;
}

/// The palette and shapes the Home screens are drawn in, and with them the
/// rest of both apps: a white page, softly shadowed white cards on a hairline,
/// deep navy ink, and a pastel ground per metric so a tile is recognised by
/// colour before it is read. [AppColors] above still holds the brand blue and
/// the status colours; these are the surfaces they sit on.
class Home {
  static const page = Color(0xFFFFFFFF);
  static const ink = Color(0xFF12284C);
  static const inkSoft = Color(0xFF5E7290);
  static const inkMuted = Color(0xFF8C9AAF);
  static const line = Color(0xFFEBEFF5);

  static const green = Color(0xFF17A05C);
  static const greenSoft = Color(0xFFDDF5E7);
  static const amber = Color(0xFFF5A623);
  static const amberInk = Color(0xFFB95A00);
  static const amberSoft = Color(0xFFFEF1DE);
  static const blueSoft = Color(0xFFE4EFFC);

  static const cardRadius = 14.0;
  static const tileRadius = 16.0;

  static const shadow = [
    BoxShadow(color: Color(0x0D123A6B), blurRadius: 14, offset: Offset(0, 4)),
  ];
}
