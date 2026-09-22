import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/widgets/list_with_header.dart';

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(780, 1600);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(MaterialApp(home: Scaffold(body: child)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('builds only the rows on screen, not the whole list', (tester) async {
    final built = <int>[];

    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        itemCount: 500,
        itemBuilder: (context, index) {
          built.add(index);
          return SizedBox(height: 80, child: Text('Row $index'));
        },
      ),
    );

    expect(find.text('Header'), findsOneWidget);
    expect(find.text('Row 0'), findsOneWidget);
    // The whole point: a 500-row list must not build 500 rows up front.
    expect(built.length, lessThan(60), reason: 'built ${built.length} of 500 rows');
    expect(built, isNot(contains(499)));
  });

  testWidgets('scrolling reaches rows that were never built at first', (tester) async {
    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        itemCount: 500,
        itemBuilder: (context, index) => SizedBox(height: 80, child: Text('Row $index')),
      ),
    );

    expect(find.text('Row 400'), findsNothing);
    await tester.scrollUntilVisible(find.text('Row 400'), 500, maxScrolls: 200);
    expect(find.text('Row 400'), findsOneWidget);
  });

  testWidgets('shows the empty slot in place of the rows, keeping the header', (tester) async {
    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        empty: const Text('Nothing here'),
        itemCount: 0,
        itemBuilder: (context, index) => const Text('never'),
      ),
    );

    expect(find.text('Header'), findsOneWidget);
    expect(find.text('Nothing here'), findsOneWidget);
    expect(find.text('never'), findsNothing);
  });

  testWidgets('with no empty slot an empty list is just the header', (tester) async {
    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        itemCount: 0,
        itemBuilder: (context, index) => const Text('never'),
      ),
    );

    expect(find.text('Header'), findsOneWidget);
    expect(find.text('never'), findsNothing);
  });

  testWidgets('the footer sits after the last row', (tester) async {
    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        itemCount: 3,
        itemBuilder: (context, index) => SizedBox(height: 40, child: Text('Row $index')),
        footer: const Text('Load More'),
      ),
    );

    expect(find.text('Row 2'), findsOneWidget);
    expect(find.text('Load More'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Load More')).dy,
      greaterThan(tester.getTopLeft(find.text('Row 2')).dy),
    );
  });

  testWidgets('the footer still shows when there are no rows', (tester) async {
    await _pump(
      tester,
      ListWithHeader(
        header: const Text('Header'),
        empty: const Text('Nothing here'),
        itemCount: 0,
        itemBuilder: (context, index) => const Text('never'),
        footer: const Text('Load More'),
      ),
    );

    expect(find.text('Nothing here'), findsOneWidget);
    expect(find.text('Load More'), findsOneWidget);
  });

  testWidgets('a short list still drags, so pull-to-refresh works', (tester) async {
    var refreshed = 0;

    await _pump(
      tester,
      RefreshIndicator(
        onRefresh: () async => refreshed++,
        child: ListWithHeader(
          header: const Text('Header'),
          empty: const Text('Nothing here'),
          itemCount: 0,
          itemBuilder: (context, index) => const Text('never'),
        ),
      ),
    );

    await tester.fling(find.text('Header'), const Offset(0, 320), 1000);
    await tester.pumpAndSettle();

    expect(refreshed, 1);
  });
}
