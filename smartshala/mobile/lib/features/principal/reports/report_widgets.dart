import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_chips.dart';

/// Writes [csv] to a temporary file and opens the Android share sheet, the
/// way Export List does on the management screens.
Future<void> shareReportCsv({required String name, required String csv, required String subject}) async {
  final directory = await getTemporaryDirectory();
  final file = File('${directory.path}/$name-${DateFormat('yyyy-MM-dd').format(DateTime.now())}.csv');
  await file.writeAsString(csv);
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'text/csv')], subject: subject));
}

/// An app bar action that exports the report on screen.
class ExportCsvAction extends StatelessWidget {
  const ExportCsvAction({super.key, required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Export CSV',
      onPressed: onPressed,
      icon: const Icon(Icons.ios_share_rounded),
    );
  }
}

/// Green at 85% and above, amber from 75%, red below — the web's attendance
/// thresholds ("Healthy", "Watch", "Needs attention").
StatusChip percentChip(int? percent, {String suffix = '%'}) {
  if (percent == null) return const StatusChip(label: '—', color: AppColors.textSecondary, tint: AppColors.background);
  final label = '$percent$suffix';
  if (percent >= 85) return StatusChip(label: label, color: AppColors.success, tint: AppColors.successSoft);
  if (percent >= 75) return StatusChip(label: label, color: AppColors.warning, tint: AppColors.warningSoft);
  return StatusChip(label: label, color: AppColors.danger, tint: AppColors.dangerSoft);
}
