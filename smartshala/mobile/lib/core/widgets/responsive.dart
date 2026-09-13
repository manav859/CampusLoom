import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Width breakpoints shared by every screen, so layouts change at the same
/// sizes everywhere.
class Breakpoints {
  /// Below this, a small phone: grids drop a column.
  static const compact = 360.0;

  /// Large phones in landscape and tablets.
  static const medium = 600.0;

  /// The widest the app content ever grows. Beyond it the screen is centred,
  /// the way the web dashboard keeps a readable column on wide monitors.
  static const maxContentWidth = 840.0;
}

/// Wraps the whole app (MaterialApp.builder) so every screen — app bar,
/// content, punch bar and navigation — behaves the same on any device:
/// content is capped at [Breakpoints.maxContentWidth] and centred, and system
/// font scaling is honoured up to a limit the layouts are designed for.
class AppViewport extends StatelessWidget {
  const AppViewport({super.key, required this.child});

  final Widget? child;

  static const maxTextScale = 1.3;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final cappedWidth = width > Breakpoints.maxContentWidth ? Breakpoints.maxContentWidth : width;

    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: SizedBox(
          width: cappedWidth,
          child: MediaQuery(
            data: media.copyWith(
              size: Size(cappedWidth, media.size.height),
              textScaler: media.textScaler.clamp(maxScaleFactor: maxTextScale),
            ),
            child: child ?? const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

/// Column count for a grid of tiles at [width]: [phone] on a normal phone,
/// one fewer on a small phone, [wide] from [Breakpoints.medium] up.
int adaptiveColumns(double width, {required int phone, required int wide}) {
  if (width >= Breakpoints.medium) return wide;
  if (width < Breakpoints.compact) return phone > 1 ? phone - 1 : 1;
  return phone;
}

/// Lays [children] out in rows of equal-width cells whose height follows
/// their content — unlike GridView, which fixes an aspect ratio and clips
/// text when the font is scaled up.
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({
    super.key,
    required this.children,
    required this.phoneColumns,
    required this.wideColumns,
    this.spacing = 10,
  });

  final List<Widget> children;
  final int phoneColumns;
  final int wideColumns;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = adaptiveColumns(
          constraints.maxWidth,
          phone: phoneColumns,
          wide: wideColumns,
        );
        final rows = <Widget>[];

        for (var start = 0; start < children.length; start += columns) {
          final cells = <Widget>[];
          for (var column = 0; column < columns; column++) {
            final index = start + column;
            if (column > 0) cells.add(SizedBox(width: spacing));
            cells.add(Expanded(child: index < children.length ? children[index] : const SizedBox()));
          }
          if (rows.isNotEmpty) rows.add(SizedBox(height: spacing));
          rows.add(IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells),
          ));
        }

        return Column(mainAxisSize: MainAxisSize.min, children: rows);
      },
    );
  }
}
