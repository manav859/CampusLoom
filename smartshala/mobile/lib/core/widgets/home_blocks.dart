import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'auto_scroll_text.dart';
import 'brand_header.dart';

/// The shared building blocks of the phone home screens, so the teacher and
/// principal dashboards read as one product: the brand row that replaces the
/// app bar, the greeting, the rounded surface, the pastel KPI block and the
/// quick-action tile. Labels that do not fit scroll rather than wrap, which
/// keeps every tile in a grid row the same height.

/// The logo and wordmark that stand in for an app bar, with its controls on the
/// right. The product already knows which app it is, so nothing here says the
/// role.
class HomeBrandRow extends StatelessWidget {
  const HomeBrandRow({super.key, this.actions = const []});

  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const BrandLogo(size: 38),
        const SizedBox(width: 10),
        const Expanded(
          child: Text(
            'SmartShala',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: Home.ink,
              letterSpacing: -0.3,
            ),
          ),
        ),
        ...actions,
      ],
    );
  }
}

/// A round, tappable header icon with an optional unread dot.
class HomeHeaderButton extends StatelessWidget {
  const HomeHeaderButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onTap,
    this.dot = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(icon, size: 25, color: Home.ink),
              if (dot)
                Positioned(
                  right: 1,
                  top: 0,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF2374A),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Good Morning," then the name, then a one-line subtitle.
class HomeGreeting extends StatelessWidget {
  const HomeGreeting({super.key, required this.name, this.subtitle});

  final String name;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final greeting = switch (DateTime.now().hour) {
      < 12 => 'Good Morning,',
      < 17 => 'Good Afternoon,',
      _ => 'Good Evening,',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          greeting,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: Home.ink,
            height: 1.3,
          ),
        ),
        Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w800,
            color: Home.ink,
            height: 1.3,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, color: Home.inkMuted, height: 1.3),
          ),
        ],
      ],
    );
  }
}

/// White, softly shadowed, rounded surface — every section row on Home.
class HomeSurface extends StatelessWidget {
  const HomeSurface({super.key, required this.child, this.padding, this.onTap});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(Home.cardRadius);

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: shape, boxShadow: Home.shadow),
      child: Material(
        color: AppColors.surface,
        borderRadius: shape,
        child: InkWell(
          onTap: onTap,
          borderRadius: shape,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: shape,
              border: Border.all(color: Home.line),
            ),
            child: Padding(
              padding: padding ?? const EdgeInsets.all(14),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// A metric on its own pastel ground: the label, then the figure and a chevron.
/// The label scrolls if it is too long; the figure shrinks to fit. Both stay on
/// one line, so every block in a grid row is the same height.
class KpiBlock extends StatelessWidget {
  const KpiBlock({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.ground,
    required this.accent,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color ground;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(Home.tileRadius);

    return Material(
      color: ground,
      borderRadius: shape,
      child: InkWell(
        onTap: onTap,
        borderRadius: shape,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(13, 13, 11, 11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 16,
                      child: AutoScrollText(
                        label,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: Home.inkSoft,
                          height: 1.25,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        value,
                        maxLines: 1,
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w700,
                          color: Home.ink,
                          height: 1.1,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ),
                  if (onTap != null)
                    Icon(Icons.chevron_right_rounded, size: 20, color: accent),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A white quick-action tile: a circular tinted icon, a one-line title that
/// scrolls if it is long, and an optional count badge.
class HomeQuickAction extends StatelessWidget {
  const HomeQuickAction({
    super.key,
    required this.icon,
    required this.title,
    required this.chip,
    required this.accent,
    this.badge = 0,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final Color chip;
  final Color accent;
  final int badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HomeSurface(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: chip, shape: BoxShape.circle),
                child: Icon(icon, size: 21, color: accent),
              ),
              if (badge > 0)
                Positioned(
                  right: -8,
                  top: -6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    constraints: const BoxConstraints(minWidth: 20),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.surface, width: 1.5),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 15,
            child: AutoScrollText(
              title,
              alignment: Alignment.center,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Home.ink,
                height: 1.25,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
