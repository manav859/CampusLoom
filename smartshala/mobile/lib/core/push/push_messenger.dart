import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../theme/app_colors.dart';
import 'push_service.dart';

/// Shows a notification that arrives while the app is open and on screen.
///
/// Android posts nothing to the shade for a foreground notification, so without
/// this a teacher reading the Messages tab would never learn their leave had
/// just been approved. On iOS the system draws its own banner and
/// [PushService] publishes nothing here.
class PushMessenger extends StatefulWidget {
  const PushMessenger({super.key, required this.child});

  final Widget child;

  @override
  State<PushMessenger> createState() => _PushMessengerState();
}

class _PushMessengerState extends State<PushMessenger> {
  PushService? _service;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final service = context.read<PushService>();
    if (service == _service) return;
    _service?.removeListener(_onPushChanged);
    _service = service..addListener(_onPushChanged);
    // A notification may already be waiting: the listener attaches after the
    // first frame, and the message that arrived before it is still pending.
    _onPushChanged();
  }

  void _onPushChanged() {
    final message = _service?.takePendingBanner();
    if (message == null) return;

    // A notification can land mid-frame, and a SnackBar cannot be shown while
    // one is being built.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final messenger = ScaffoldMessenger.maybeOf(context);
      if (messenger == null) return;

      messenger
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(message.bannerText),
            backgroundColor: AppColors.primary,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
          ),
        );
    });
  }

  @override
  void dispose() {
    _service?.removeListener(_onPushChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
