import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';

enum PunchAction { punchIn, punchOut }

/// Horizontal swipe bar on the teacher's Home punch card.
///
/// The blueprint is explicit that this is a swipe gesture and must never be
/// replaced by a circular tap button, so the control exposes no onTap path:
/// the handle has to be dragged past [_completionThreshold] of the track to
/// fire. Anything short of that springs back.
class SwipeToPunch extends StatefulWidget {
  const SwipeToPunch({
    super.key,
    required this.action,
    required this.onConfirmed,
    this.enabled = true,
    this.busy = false,
    this.completedLabel,
    this.label,
  });

  final PunchAction action;
  final Future<void> Function() onConfirmed;
  final bool enabled;
  final bool busy;

  /// When set, the control renders as a finished, non-interactive state.
  final String? completedLabel;

  /// Replaces the default prompt, e.g. "End Break".
  final String? label;

  @override
  State<SwipeToPunch> createState() => _SwipeToPunchState();
}

class _SwipeToPunchState extends State<SwipeToPunch> with SingleTickerProviderStateMixin {
  static const _handleSize = 46.0;
  static const _trackHeight = 56.0;
  static const _padding = 5.0;
  static const _completionThreshold = 0.82;

  // Created eagerly: a `late final` field would be constructed inside dispose()
  // whenever the bar was never dragged, which throws because the element is
  // already deactivated by then.
  late final AnimationController _controller;

  double _dragFraction = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 240),
    )..addListener(() => setState(() => _dragFraction = _controller.value));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _interactive =>
      widget.enabled && !widget.busy && widget.completedLabel == null;

  /// Both directions ride the same brand-blue track, as the home-screen
  /// design shows it; the prompt names the action instead.
  Color get _accent => AppColors.primary;

  List<Color> get _trackColors => const [AppColors.primary, Color(0xFF4C7BF0)];

  void _onDragUpdate(DragUpdateDetails details, double maxTravel) {
    if (!_interactive || maxTravel <= 0) return;
    setState(() {
      _dragFraction = (_dragFraction + details.delta.dx / maxTravel).clamp(0.0, 1.0);
    });
  }

  Future<void> _onDragEnd() async {
    if (!_interactive) return;

    if (_dragFraction < _completionThreshold) {
      _springBack();
      return;
    }

    // Snap to the end so the handle reads as "completed" while the call runs.
    _controller.value = _dragFraction;
    await _controller.animateTo(1, duration: const Duration(milliseconds: 120));

    // Fire-and-forget: haptics are cosmetic, and a device without a vibrator
    // throws MissingPluginException. That must never block the punch itself.
    unawaited(HapticFeedback.mediumImpact().catchError((Object _) {}));

    try {
      await widget.onConfirmed();
    } finally {
      if (mounted) _springBack();
    }
  }

  void _springBack() {
    _controller.value = _dragFraction;
    _controller.animateTo(0, curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final completed = widget.completedLabel != null;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxTravel = constraints.maxWidth - _handleSize - (_padding * 2);

        return Container(
          height: _trackHeight,
          decoration: BoxDecoration(
            gradient: completed || !widget.enabled
                ? null
                : LinearGradient(
                    colors: _trackColors,
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
            color: completed
                ? AppColors.successSoft
                : (!widget.enabled ? AppColors.border : null),
            borderRadius: BorderRadius.circular(_trackHeight / 2),
            boxShadow: completed || !widget.enabled
                ? null
                : [
                    BoxShadow(
                      color: _accent.withValues(alpha: 0.28),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              _buildLabel(completed),
              if (!completed)
                Positioned(
                  left: _padding + (_dragFraction * maxTravel),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onHorizontalDragUpdate: (details) => _onDragUpdate(details, maxTravel),
                    onHorizontalDragEnd: (_) => _onDragEnd(),
                    onHorizontalDragCancel: _springBack,
                    child: _Handle(size: _handleSize, busy: widget.busy, accent: _accent),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLabel(bool completed) {
    if (completed) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              widget.completedLabel!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w700,
                fontSize: 14.5,
              ),
            ),
          ),
        ],
      );
    }

    final label = widget.label ??
        (widget.action == PunchAction.punchIn ? 'Swipe to Punch In' : 'Swipe to Punch Out');

    // Fade the prompt out as the handle covers it.
    return Opacity(
      opacity: (1 - (_dragFraction * 1.6)).clamp(0.0, 1.0),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: _handleSize + _padding + 6),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: widget.enabled ? Colors.white : AppColors.textMuted,
            fontWeight: FontWeight.w700,
            fontSize: 15.5,
          ),
        ),
      ),
    );
  }
}

class _Handle extends StatelessWidget {
  const _Handle({required this.size, required this.busy, required this.accent});

  final double size;
  final bool busy;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: busy
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: accent),
            )
          : Icon(Icons.arrow_forward_rounded, color: accent, size: 22),
    );
  }
}
