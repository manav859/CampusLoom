import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_chips.dart';
import '../data/principal_repository.dart';

/// The web's fee status tones: green paid, amber partial, red otherwise.
StatusChip feeAssignmentChip(String status) => switch (status) {
      'PAID' => StatusChip(label: humanizeConstant(status), color: AppColors.success, tint: AppColors.successSoft),
      'PARTIAL' => StatusChip(label: humanizeConstant(status), color: AppColors.warning, tint: AppColors.warningSoft),
      _ => StatusChip(label: humanizeConstant(status), color: AppColors.danger, tint: AppColors.dangerSoft),
    };

/// Downloads a receipt PDF and hands it to the Android share sheet, where it
/// can be saved, printed or sent to a parent.
Future<void> shareReceiptPdf(PrincipalRepository repository, {required String receiptId, required String receiptNo}) async {
  final bytes = await repository.receiptPdf(receiptId);
  final directory = await getTemporaryDirectory();
  final file = File('${directory.path}/receipt-$receiptNo.pdf');
  await file.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(
    ShareParams(files: [XFile(file.path, mimeType: 'application/pdf')], subject: 'Fee receipt $receiptNo'),
  );
}

void showFeeToast(BuildContext context, String message, {bool isError = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? AppColors.danger : AppColors.success,
    ));
}

/// A small uppercase caption over a figure — the web ledger's summary cells.
class MoneyFigure extends StatelessWidget {
  const MoneyFigure({super.key, required this.label, required this.value, this.color = AppColors.textPrimary});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 0.6, color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: color)),
        ),
      ],
    );
  }
}
