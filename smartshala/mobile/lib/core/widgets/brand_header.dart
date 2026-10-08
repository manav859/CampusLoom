import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The web dashboard's logo, as the apps show it everywhere: the app bar, the
/// sign-in screen and the launch screen. Generated from the web's own file by
/// tool/generate_brand_assets.dart.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 34});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.28),
      child: Image.asset(
        'assets/brand/logo.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.medium,
        semanticLabel: 'SmartShala',
      ),
    );
  }
}

/// The "SmartShala / PRINCIPAL APP" lockup that tops every screen in the
/// blueprint, with the notification bell and its unread badge.
class BrandAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BrandAppBar({
    super.key,
    required this.portalLabel,
    this.leading,
    this.notificationCount = 0,
    this.onNotificationsTap,
  });

  final String portalLabel;
  final Widget? leading;
  final int notificationCount;
  final VoidCallback? onNotificationsTap;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      toolbarHeight: 64,
      leading: leading,
      // Scales down rather than overflowing on a small phone with large text.
      title: FittedBox(fit: BoxFit.scaleDown, child: _Lockup(portalLabel: portalLabel)),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: _NotificationBell(count: notificationCount, onTap: onNotificationsTap),
        ),
      ],
      shape: const Border(bottom: BorderSide(color: AppColors.border)),
    );
  }
}

class _Lockup extends StatelessWidget {
  const _Lockup({required this.portalLabel});

  final String portalLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        const BrandLogo(),
        const SizedBox(width: 10),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'SmartShala',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                height: 1.1,
              ),
            ),
            Text(
              portalLabel,
              style: const TextStyle(
                fontSize: 9,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.count, this.onTap});

  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(Icons.notifications_none_rounded, size: 26, color: AppColors.textPrimary),
            if (count > 0)
              Positioned(
                right: -4,
                top: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  constraints: const BoxConstraints(minWidth: 18),
                  child: Text(
                    count > 9 ? '9+' : '$count',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
