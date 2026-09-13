import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';

enum PunchAction { punchIn, punchOut }

/// Horizontal "Swipe To Punch" bar that sits directly above the bottom
/// navigation on every teacher screen.
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
  });

  final PunchAction action;
  final Future<void> Function() onConfirmed;
  final bool enabled;
  final bool busy;

  /// When set, the control renders as a finished, non-interactive state.
  final String? completedLabel;

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
  bool _dragging = false;

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

  void _onDragUpdate(DragUpdateDetails details, double maxTravel) {
    if (!_interactive || maxTravel <= 0) return;
    setState(() {
      _dragging = true;
      _dragFraction = (_dragFraction + details.delta.dx / maxTravel).clamp(0.0, 1.0);
    });
  }

  Future<void> _onDragEnd() async {
    if (!_interactive) return;
    setState(() => _dragging = false);

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
                : const LinearGradient(
                    colors: [AppColors.primaryDark, AppColors.primary],
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
                      color: AppColors.primary.withValues(alpha: 0.28),
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
                    child: _Handle(size: _handleSize, busy: widget.busy),
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

    final label = widget.action == PunchAction.punchIn ? 'Swipe To Punch In' : 'Swipe To Punch Out';

    // Fade the prompt out as the handle covers it.
    return Opacity(
      opacity: (1 - (_dragFraction * 1.6)).clamp(0.0, 1.0),
      child: Padding(
        padding: const EdgeInsets.only(left: 46),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _Chevrons(animate: !_dragging && _interactive),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: widget.enabled ? Colors.white : AppColors.textMuted,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Handle extends StatelessWidget {
  const _Handle({required this.size, required this.busy});

  final double size;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.primary),
            )
          : const Icon(Icons.keyboard_double_arrow_right_rounded,
              color: AppColors.primary, size: 24),
    );
  }
}

/// The "› › ›" trail that hints at the drag direction.
class _Chevrons extends StatefulWidget {
  const _Chevrons({required this.animate});

  final bool animate;

  @override
  State<_Chevrons> createState() => _ChevronsState();
}

class _ChevronsState extends State<_Chevrons> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            final phase = ((_controller.value * 3) - index) % 3;
            final opacity = widget.animate ? (phase < 1 ? 0.35 + (phase * 0.65) : 0.35) : 0.4;
            return Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 18),
            );
          }),
        );
      },
    );
  }
}
