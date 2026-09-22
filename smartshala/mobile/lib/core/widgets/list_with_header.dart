import 'package:flutter/material.dart';

/// A long list that builds only the rows on screen, with the screen's own
/// header scrolling above them.
///
/// Every list in both apps used to be a plain `ListView(children: [...])`,
/// which builds every row before the first frame. That is fine for a class
/// roster of forty, and not fine for a school-wide report where the server
/// returns every student. The header stays one widget, so a screen converts
/// by wrapping what it already had in [header] and moving its row loop into
/// [itemBuilder].
class ListWithHeader extends StatelessWidget {
  const ListWithHeader({
    super.key,
    required this.header,
    required this.itemCount,
    required this.itemBuilder,
    this.padding = EdgeInsets.zero,
    this.empty,
    this.footer,
  });

  /// Everything above the rows: filters, stat tiles, counts.
  final Widget header;

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final EdgeInsetsGeometry padding;

  /// Shown in place of the rows when there are none.
  final Widget? empty;

  /// Below the rows — a Load More button, a total, a note.
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final showEmpty = itemCount == 0 && empty != null;
    final rows = showEmpty ? 1 : itemCount;
    final hasFooter = footer != null;

    return ListView.builder(
      padding: padding,
      // A short list must still drag, or pull-to-refresh dies on exactly the
      // screens where there is nothing to look at.
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: 1 + rows + (hasFooter ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == 0) return header;
        if (hasFooter && index == rows + 1) return footer!;
        return showEmpty ? empty! : itemBuilder(context, index - 1);
      },
    );
  }
}
