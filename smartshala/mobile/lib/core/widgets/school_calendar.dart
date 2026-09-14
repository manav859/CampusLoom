import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../data/calendar_models.dart';
import '../theme/app_colors.dart';
import 'app_cards.dart';
import 'app_chips.dart';
import 'state_views.dart';

/// The school calendar both apps show: a month grid with a dot per kind of
/// event, a legend that doubles as a filter, and the month's events below.
/// Tapping a day narrows the list to that day; tapping it again widens it.
///
/// The teacher's is read-only. The principal's passes [onAddEvent] and
/// [onEventTap]; each resolves `true` when the calendar changed, and the month
/// on screen is then read again.
class SchoolCalendarScreen extends StatefulWidget {
  const SchoolCalendarScreen({
    super.key,
    required this.loadMonth,
    this.title = 'Calendar',
    this.onAddEvent,
    this.onEventTap,
  });

  final Future<List<CalendarEvent>> Function(DateTime month) loadMonth;
  final String title;

  /// Receives the selected day, if any, to start the new event on.
  final Future<bool> Function(DateTime? day)? onAddEvent;
  final Future<bool> Function(CalendarEvent event)? onEventTap;

  @override
  State<SchoolCalendarScreen> createState() => _SchoolCalendarScreenState();
}

class _SchoolCalendarScreenState extends State<SchoolCalendarScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime? _selectedDay;
  final Set<CalendarEventType> _hidden = <CalendarEventType>{};

  List<CalendarEvent> _events = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _addEvent() async {
    final changed = await widget.onAddEvent!(_selectedDay);
    if (changed && mounted) await _load();
  }

  Future<void> _openEvent(CalendarEvent event) async {
    final changed = await widget.onEventTap!(event);
    if (changed && mounted) await _load();
  }

  Future<void> _load() async {
    final month = _month;
    try {
      final events = await widget.loadMonth(month);
      // A slow response for a month already paged away from
      // must not overwrite the month now on screen.
      if (!mounted || month != _month) return;
      setState(() {
        _events = events;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted || month != _month) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _retry() {
    setState(() {
      _loading = true;
      _error = null;
    });
    _load();
  }

  void _changeMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _selectedDay = null;
      _events = const [];
      _loading = true;
      _error = null;
    });
    _load();
  }

  void _toggleDay(DateTime day) =>
      setState(() => _selectedDay = _selectedDay == day ? null : day);

  void _toggleType(CalendarEventType type) => setState(() {
        if (!_hidden.remove(type)) _hidden.add(type);
      });

  @override
  Widget build(BuildContext context) {
    final visible = _events.where((event) => !_hidden.contains(event.type)).toList();
    final selectedDay = _selectedDay;
    final listed = selectedDay == null
        ? visible
        : visible.where((event) => event.occursOn(selectedDay)).toList();

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      floatingActionButton: widget.onAddEvent == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _addEvent,
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add New Event'),
            ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          // Room under the last event for the Add New Event button.
          padding: EdgeInsets.fromLTRB(16, 8, 16, widget.onAddEvent == null ? 24 : 96),
          children: [
            AppCard(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
              child: Column(
                children: [
                  _MonthHeader(
                    month: _month,
                    onPrevious: () => _changeMonth(-1),
                    onNext: () => _changeMonth(1),
                  ),
                  const SizedBox(height: 6),
                  _MonthGrid(
                    month: _month,
                    events: visible,
                    selectedDay: selectedDay,
                    onDayTap: _toggleDay,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _LegendFilter(hidden: _hidden, onToggle: _toggleType),
            const SizedBox(height: 22),
            SectionHeader(
              title: selectedDay == null
                  ? 'Events in ${DateFormat('MMMM').format(_month)}'
                  : 'Events on ${DateFormat('d MMMM').format(selectedDay)}',
              action: selectedDay == null
                  ? null
                  : TextButton(
                      onPressed: () => setState(() => _selectedDay = null),
                      child: const Text('Whole month'),
                    ),
            ),
            _buildEvents(listed),
          ],
        ),
      ),
    );
  }

  Widget _buildEvents(List<CalendarEvent> events) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: LoadingView(),
      );
    }

    if (_error != null) return ErrorView(message: _error!, onRetry: _retry);

    if (events.isEmpty) {
      return AppCard(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: EmptyView(
          icon: Icons.event_busy_rounded,
          title: _selectedDay == null ? 'Nothing scheduled this month' : 'Nothing on this day',
          message: _hidden.isEmpty ? null : 'Some event types are hidden by the filter above.',
        ),
      );
    }

    return Column(
      children: [
        for (final event in events) ...[
          _EventCard(
            event: event,
            onTap: widget.onEventTap == null ? null : () => _openEvent(event),
          ),
          if (event != events.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.month, required this.onPrevious, required this.onNext});

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: onPrevious,
          tooltip: 'Previous month',
          icon: const Icon(Icons.chevron_left_rounded),
        ),
        Expanded(
          child: Text(
            DateFormat('MMMM yyyy').format(month),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        IconButton(
          onPressed: onNext,
          tooltip: 'Next month',
          icon: const Icon(Icons.chevron_right_rounded),
        ),
      ],
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.events,
    required this.selectedDay,
    required this.onDayTap,
  });

  final DateTime month;
  final List<CalendarEvent> events;
  final DateTime? selectedDay;
  final ValueChanged<DateTime> onDayTap;

  static const _weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  static final _keyFormat = DateFormat('yyyy-MM-dd');

  @override
  Widget build(BuildContext context) {
    // Sunday-first. DateTime.weekday runs 1 (Monday) to 7 (Sunday).
    final leadingBlanks = DateTime(month.year, month.month).weekday % 7;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Column(
      children: [
        Row(
          children: [
            for (var column = 0; column < 7; column++)
              Expanded(
                child: Center(
                  child: Text(
                    _weekdays[column],
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: column == 0 ? AppColors.danger : AppColors.textMuted,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          childAspectRatio: 0.92,
          children: [
            for (var blank = 0; blank < leadingBlanks; blank++) const SizedBox.shrink(),
            for (var date = 1; date <= daysInMonth; date++)
              _dayCell(DateTime(month.year, month.month, date), today),
          ],
        ),
      ],
    );
  }

  Widget _dayCell(DateTime day, DateTime today) {
    final onDay = events.where((event) => event.occursOn(day)).toList();
    final types = CalendarEventType.values
        .where((type) => onDay.any((event) => event.type == type))
        .toList();

    return _DayCell(
      key: ValueKey('calendar-day-${_keyFormat.format(day)}'),
      day: day,
      types: types,
      isToday: day == today,
      isSelected: day == selectedDay,
      // Sundays are always closed; the attendance module treats them the same.
      isOff: day.weekday == DateTime.sunday || types.contains(CalendarEventType.holiday),
      onTap: () => onDayTap(day),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    super.key,
    required this.day,
    required this.types,
    required this.isToday,
    required this.isSelected,
    required this.isOff,
    required this.onTap,
  });

  final DateTime day;
  final List<CalendarEventType> types;
  final bool isToday;
  final bool isSelected;
  final bool isOff;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textColor = isSelected
        ? Colors.white
        : isToday
            ? AppColors.primary
            : isOff
                ? AppColors.danger
                : AppColors.textPrimary;
    final radius = BorderRadius.circular(10);

    return Padding(
      padding: const EdgeInsets.all(2),
      child: Material(
        color: isSelected
            ? AppColors.primary
            : isToday
                ? AppColors.primarySoft
                : Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: isToday || isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 5,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final type in types)
                      Container(
                        width: 5,
                        height: 5,
                        margin: const EdgeInsets.symmetric(horizontal: 1.5),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.white : type.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The colour key for the grid's dots. Each entry is also a toggle, so the
/// legend is the filter rather than a second control beside it.
class _LegendFilter extends StatelessWidget {
  const _LegendFilter({required this.hidden, required this.onToggle});

  final Set<CalendarEventType> hidden;
  final ValueChanged<CalendarEventType> onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final type in CalendarEventType.values)
          _LegendChip(
            type: type,
            active: !hidden.contains(type),
            onTap: () => onToggle(type),
          ),
      ],
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.type, required this.active, required this.onTap});

  final CalendarEventType type;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(20);

    return Semantics(
      button: true,
      toggled: active,
      child: Material(
        color: active ? type.tint : AppColors.surface,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: active ? type.tint : AppColors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: active ? type.color : Colors.transparent,
                      shape: BoxShape.circle,
                      border: Border.all(color: active ? type.color : AppColors.textMuted),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    type.pluralLabel,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: active ? type.color : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, this.onTap});

  final CalendarEvent event;
  final VoidCallback? onTap;

  String get _when {
    final start = event.startDate;
    final end = event.endDate;
    if (!event.isMultiDay) return DateFormat('EEE, d MMM').format(start);

    final sameMonth = start.year == end.year && start.month == end.month;
    final from = sameMonth ? '${start.day}' : DateFormat('d MMM').format(start);
    return '$from – ${DateFormat('d MMM').format(end)}';
  }

  @override
  Widget build(BuildContext context) {
    final type = event.type;
    final description = event.description?.trim();

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: type.tint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  '${event.startDate.day}',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: type.color,
                    height: 1.1,
                  ),
                ),
                Text(
                  DateFormat('MMM').format(event.startDate).toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: type.color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    StatusChip(
                      label: type.label,
                      color: type.color,
                      tint: type.tint,
                      icon: type.icon,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        _when,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
                if (description != null && description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
