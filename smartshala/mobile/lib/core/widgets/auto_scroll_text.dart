import 'package:flutter/material.dart';

/// A single line of text that scrolls itself horizontally when it does not fit,
/// instead of wrapping onto a second line or clipping. When the text fits, it
/// renders as a plain, static [Text]; only an overflowing string animates.
///
/// It is used across the home dashboards so a long label or a wide number keeps
/// a tile's layout fixed — the block never grows a line taller than its siblings
/// in a grid row. The scroll is a continuous loop with a gap between repeats, at
/// a steady, unhurried speed.
class AutoScrollText extends StatefulWidget {
  const AutoScrollText(
    this.text, {
    super.key,
    required this.style,
    this.alignment = Alignment.centerLeft,
    this.velocity = 26,
    this.gap = 40,
  });

  final String text;
  final TextStyle style;

  /// Where the text sits while it fits without scrolling.
  final Alignment alignment;

  /// Scroll speed, logical pixels per second.
  final double velocity;

  /// Empty space between the end of one pass and the start of the next.
  final double gap;

  @override
  State<AutoScrollText> createState() => _AutoScrollTextState();
}

class _AutoScrollTextState extends State<AutoScrollText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _measure(BuildContext context) {
    final painter = TextPainter(
      text: TextSpan(text: widget.text, style: widget.style),
      maxLines: 1,
      textDirection: Directionality.of(context),
    )..layout();
    final width = painter.width;
    painter.dispose();
    return width;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final textWidth = _measure(context);

        // Half a pixel of slack so a value that measures exactly the width does
        // not jitter between the two branches on successive layouts.
        if (!maxWidth.isFinite || textWidth <= maxWidth + 0.5) {
          if (_controller.isAnimating) _controller.stop();
          return Align(
            alignment: widget.alignment,
            child: Text(
              widget.text,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.clip,
              style: widget.style,
            ),
          );
        }

        // One pass travels the text plus the gap, so the trailing copy lands
        // exactly where the leading one began and the loop is seamless.
        final span = textWidth + widget.gap;
        final seconds = (span / widget.velocity).clamp(3.0, 24.0);
        final duration = Duration(milliseconds: (seconds * 1000).round());
        if (_controller.duration != duration) _controller.duration = duration;
        if (!_controller.isAnimating) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && !_controller.isAnimating) _controller.repeat();
          });
        }

        final line = Text(
          widget.text,
          maxLines: 1,
          softWrap: false,
          style: widget.style,
        );

        return ClipRect(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return OverflowBox(
                alignment: Alignment.centerLeft,
                minWidth: 0,
                maxWidth: double.infinity,
                child: Transform.translate(
                  offset: Offset(-_controller.value * span, 0),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [line, SizedBox(width: widget.gap), line],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
