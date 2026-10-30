import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/message_log_models.dart';
import '../data/principal_repository.dart';

/// Message Logs — the sent-notification trail the web dashboard shows, newest
/// first, filterable by delivery status.
class MessageLogsScreen extends StatefulWidget {
  const MessageLogsScreen({super.key});

  @override
  State<MessageLogsScreen> createState() => _MessageLogsScreenState();
}

class _MessageLogsScreenState extends State<MessageLogsScreen> {
  // null = All; otherwise filter to that status.
  static const _filters = <MessageDeliveryStatus?>[null, MessageDeliveryStatus.sent, MessageDeliveryStatus.failed, MessageDeliveryStatus.queued];

  List<MessageLog> _all = [];
  int _tabIndex = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final logs = await context.read<PrincipalRepository>().messageLogs();
      if (!mounted) return;
      setState(() {
        _all = logs;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  int _countFor(MessageDeliveryStatus? status) =>
      status == null ? _all.length : _all.where((log) => log.status == status).length;

  @override
  Widget build(BuildContext context) {
    final filter = _filters[_tabIndex];
    final visible = filter == null ? _all : _all.where((log) => log.status == filter).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Message Logs')),
      body: Column(
        children: [
          if (!_loading && _error == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: SegmentedTabs(
                labels: const ['All', 'Sent', 'Failed', 'Queued'],
                counts: _filters.map(_countFor).toList(),
                index: _tabIndex,
                onChanged: (next) => setState(() => _tabIndex = next),
              ),
            ),
          Expanded(child: _buildBody(visible)),
        ],
      ),
    );
  }

  Widget _buildBody(List<MessageLog> visible) {
    if (_loading) return const LoadingView(message: 'Loading message logs…');

    if (_error != null) {
      return ListView(children: [const SizedBox(height: 80), ErrorView(message: _error!, onRetry: _load)]);
    }

    if (visible.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            SizedBox(height: 80),
            EmptyView(
              icon: Icons.forum_outlined,
              title: 'No messages',
              message: 'Parent notifications sent from SmartShala appear here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: visible.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _MessageLogCard(log: visible[index]),
      ),
    );
  }
}

class _MessageLogCard extends StatelessWidget {
  const _MessageLogCard({required this.log});

  final MessageLog log;

  static final _timeFormat = DateFormat('d MMM, h:mm a');

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      log.kindLabel,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      log.studentName == null ? log.recipientPhone : '${log.studentName} • ${log.recipientPhone}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(label: log.status.label, color: log.status.color, tint: log.status.tint),
            ],
          ),
          const SizedBox(height: 10),
          Text(log.message, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
          const SizedBox(height: 10),
          Text(
            [
              _timeFormat.format(log.sentAt ?? log.createdAt),
              if (log.sentByName != null) 'by ${log.sentByName}',
            ].join(' • '),
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
