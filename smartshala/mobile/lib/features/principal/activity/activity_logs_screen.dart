import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/dashboard_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/dashboard_widgets.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';

/// Activity Logs — the full audit trail the web dashboard shows, every change
/// across the school, newest first, in pages of 20.
class ActivityLogsScreen extends StatefulWidget {
  const ActivityLogsScreen({super.key});

  @override
  State<ActivityLogsScreen> createState() => _ActivityLogsScreenState();
}

class _ActivityLogsScreenState extends State<ActivityLogsScreen> {
  final List<ActivityEntry> _entries = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _loadingMore = false;
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
      final result = await context.read<PrincipalRepository>().activityLog(page: 1);
      if (!mounted) return;
      setState(() {
        _entries
          ..clear()
          ..addAll(result.items);
        _page = 1;
        _hasMore = result.hasMore;
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

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);

    try {
      final result = await context.read<PrincipalRepository>().activityLog(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _entries.addAll(result.items);
        _page += 1;
        _hasMore = result.hasMore;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Activity Logs')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading activity…');

    if (_error != null) {
      return ListView(children: [const SizedBox(height: 80), ErrorView(message: _error!, onRetry: _load)]);
    }

    if (_entries.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            SizedBox(height: 80),
            EmptyView(
              icon: Icons.history_rounded,
              title: 'No activity yet',
              message: 'Changes made in SmartShala appear here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          ActivityList(entries: _entries, now: DateTime.now()),
          if (_hasMore) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _loadingMore ? null : _loadMore,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loadingMore
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                  : const Text('Load More'),
            ),
          ],
        ],
      ),
    );
  }
}
