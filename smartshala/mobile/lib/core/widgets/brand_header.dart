import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/app_user.dart';
import '../auth/auth_controller.dart';
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

/// Tops every screen in both apps: who is signed in, greeted by time of day,
/// with the notification bell and its unread badge. The signed-in name is the
/// only title — the product already knows which app it is, so the branding it
/// used to carry here said nothing the user needed.
class BrandAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BrandAppBar({
    super.key,
    required this.fallbackName,
    this.leading,
    this.notificationCount = 0,
    this.onNotificationsTap,
  });

  /// Shown in place of the name until the profile has loaded.
  final String fallbackName;
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
      // The theme centres titles; a greeting reads as an address to the person,
      // so it starts at the margin like the content below it.
      centerTitle: false,
      title: _Greeting(fallbackName: fallbackName),
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

class _Greeting extends StatelessWidget {
  const _Greeting({required this.fallbackName});

  final String fallbackName;

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthController, AppUser?>((auth) => auth.user);
    final greeting = switch (DateTime.now().hour) {
      < 12 => 'Good Morning,',
      < 17 => 'Good Afternoon,',
      _ => 'Good Evening,',
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          greeting,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
            height: 1.2,
          ),
        ),
        Text(
          user?.fullName ?? fallbackName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
            height: 1.25,
          ),
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
