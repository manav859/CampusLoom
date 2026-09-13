import 'package:flutter/material.dart';

/// Labelled dropdown used for the class / exam / subject pickers that head
/// most teacher screens.
class PickerField<T> extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.labelOf,
    required this.idOf,
    required this.onChanged,
    this.hint,
  });

  final String label;
  final T? value;
  final List<T> items;
  final String Function(T item) labelOf;
  final String Function(T item) idOf;
  final ValueChanged<T> onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value == null ? null : idOf(value as T),
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      items: items
          .map(
            (item) => DropdownMenuItem(
              value: idOf(item),
              child: Text(labelOf(item), overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: (selected) {
        for (final item in items) {
          if (idOf(item) == selected) {
            onChanged(item);
            return;
          }
        }
      },
    );
  }
}
