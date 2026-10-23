import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../data/parent_models.dart';

/// Round avatar for a child: their photo when there is one, their initials on a
/// soft blue circle otherwise.
class ChildAvatar extends StatelessWidget {
  const ChildAvatar({super.key, required this.child, this.size = 44});

  final ParentChild child;
  final double size;

  @override
  Widget build(BuildContext context) {
    final photo = child.profilePhotoUrl;
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: photo != null && photo.isNotEmpty
          ? Image.network(
              photo,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _Initials(child: child, size: size),
            )
          : _Initials(child: child, size: size),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.child, required this.size});

  final ParentChild child;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      child.initials,
      style: TextStyle(
        fontSize: size * 0.36,
        fontWeight: FontWeight.w700,
        color: AppColors.primary,
      ),
    );
  }
}
