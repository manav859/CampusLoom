import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// A bottom-sheet picker. Returns a record so "All" (a null value) can be told
/// apart from dismissing the sheet.
Future<({T value})?> pickFromSheet<T>(
  BuildContext context, {
  required String title,
  required List<({String label, T value})> options,
  required T selected,
}) {
  return showModalBottomSheet<({T value})>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.7),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
            for (final option in options)
              ListTile(
                title: Text(option.label),
                trailing: option.value == selected
                    ? const Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
                onTap: () => Navigator.of(context).pop((value: option.value)),
              ),
          ],
        ),
      ),
    ),
  );
}
