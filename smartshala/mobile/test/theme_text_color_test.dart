import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/core/theme/app_colors.dart';
import 'package:smartshala_mobile/core/theme/app_theme.dart';
import 'package:smartshala_mobile/features/teacher/widgets/picker_field.dart';

void main() {
  test('every text style the theme defines carries a colour', () {
    // A style without a colour is painted white, which vanishes on white cards.
    final textTheme = AppTheme.build().textTheme;
    final styles = {
      'titleLarge': textTheme.titleLarge,
      'titleMedium': textTheme.titleMedium,
      'bodyMedium': textTheme.bodyMedium,
      'bodySmall': textTheme.bodySmall,
    };
    for (final entry in styles.entries) {
      expect(entry.value?.color, isNotNull, reason: '${entry.key} has no colour');
    }
  });

  testWidgets('a picker shows its selected value in dark text', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: Scaffold(
          body: PickerField<String>(
            label: 'Class',
            value: '6-A',
            items: const ['6-A', '7-B'],
            labelOf: (item) => item,
            idOf: (item) => item,
            onChanged: (_) {},
          ),
        ),
      ),
    );

    final text = tester.widget<RichText>(
      find.descendant(of: find.text('6-A'), matching: find.byType(RichText)),
    );
    expect(text.text.style?.color, AppColors.textPrimary);
  });
}
