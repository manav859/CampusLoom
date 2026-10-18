import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'data/quick_actions_store.dart';

/// Picks which Quick Actions sit on Home.
///
/// Nothing is lost by unticking a tile: every one of these screens is also in
/// More, which is why this is a plain list of switches and not a reordering
/// exercise. The grid keeps its own order either way.
class QuickActionsSheet extends StatefulWidget {
  const QuickActionsSheet({super.key, required this.selected});

  final List<QuickActionKey> selected;

  /// Resolves to the new selection, or null if the sheet was dismissed.
  static Future<List<QuickActionKey>?> show(
    BuildContext context, {
    required List<QuickActionKey> selected,
  }) =>
      showModalBottomSheet<List<QuickActionKey>>(
        context: context,
        isScrollControlled: true,
        backgroundColor: AppColors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
        ),
        builder: (_) => QuickActionsSheet(selected: selected),
      );

  @override
  State<QuickActionsSheet> createState() => _QuickActionsSheetState();
}

class _QuickActionsSheetState extends State<QuickActionsSheet> {
  late final Set<QuickActionKey> _chosen = widget.selected.toSet();

  static const _titles = {
    QuickActionKey.students: 'Students',
    QuickActionKey.teachers: 'Teachers',
    QuickActionKey.attendance: 'Attendance',
    QuickActionKey.fees: 'Fees',
    QuickActionKey.leave: 'Leave Requests',
    QuickActionKey.notice: 'Send Notice',
    QuickActionKey.payroll: 'Payroll',
    QuickActionKey.calendar: 'Calendar',
    QuickActionKey.exams: 'Exams',
  };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Quick Actions',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            const Text(
              'Choose the shortcuts on your Home screen. The rest stay in More.',
              style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.35),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final key in QuickActionsStore.all)
                    CheckboxListTile(
                      value: _chosen.contains(key),
                      title: Text(_titles[key]!),
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.trailing,
                      onChanged: (checked) => setState(() {
                        if (checked ?? false) {
                          _chosen.add(key);
                        } else {
                          _chosen.remove(key);
                        }
                      }),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              // An empty strip would leave Home with a heading and nothing
              // under it, so the last tile cannot be turned off.
              onPressed: _chosen.isEmpty
                  ? null
                  : () => Navigator.of(context).pop(
                        QuickActionsStore.all.where(_chosen.contains).toList(),
                      ),
              child: Text(_chosen.isEmpty ? 'Pick at least one' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }
}
