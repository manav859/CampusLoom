import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/data/calendar_models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_repository.dart';

/// The Calendar tab: the school's events and holidays for a month, which the
/// parent can step back and forth. Read-only — events are set by the school.
class ParentCalendarScreen extends StatefulWidget {
  const ParentCalendarScreen({super.key});

  @override
  State<ParentCalendarScreen> createState() => _ParentCalendarScreenState();
}

class _ParentCalendarScreenState extends State<ParentCalendarScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  List<CalendarEvent>? _data;
  String? _error;
  bool _loading = true;

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
      final data = await context.read<ParentRepository>().calendar(_month);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _step(int months) {
    setState(() => _month = DateTime(_month.year, _month.month + months));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final events = _data!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          _MonthHeader(month: _month, onPrev: () => _step(-1), onNext: () => _step(1)),
          const SizedBox(height: 14),
          if (events.isEmpty)
            const EmptyView(
              icon: Icons.event_note_rounded,
              title: 'Nothing this month',
              message: 'School events and holidays will appear here.',
            )
          else
            for (final event in events) ...[
              _EventCard(event: event),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.month, required this.onPrev, required this.onNext});

  final DateTime month;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(onPressed: onPrev, icon: const Icon(Icons.chevron_left_rounded)),
        Text(
          DateFormat('MMMM yyyy').format(month),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary),
        ),
        IconButton(onPressed: onNext, icon: const Icon(Icons.chevron_right_rounded)),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event});

  final CalendarEvent event;

  /// "10 Sep", or "10 – 12 Sep" / "28 Sep – 2 Oct" for a multi-day event.
  String get _dateLabel {
    final start = event.startDate;
    if (!event.isMultiDay) return DateFormat('d MMM').format(start);
    final end = event.endDate;
    if (start.month == end.month) {
      return '${DateFormat('d').format(start)} – ${DateFormat('d MMM').format(end)}';
    }
    return '${DateFormat('d MMM').format(start)} – ${DateFormat('d MMM').format(end)}';
  }

  @override
  Widget build(BuildContext context) {
    final type = event.type;
    final subtitle = [
      _dateLabel,
      if (event.timeLabel != null) event.timeLabel!,
    ].join('  ·  ');

    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: type.tint, borderRadius: BorderRadius.circular(12)),
            child: Icon(type.icon, size: 21, color: type.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type.label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: type.color),
                ),
                const SizedBox(height: 2),
                Text(
                  event.title,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                if (event.description != null && event.description!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    event.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ],
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.schedule_rounded, size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
