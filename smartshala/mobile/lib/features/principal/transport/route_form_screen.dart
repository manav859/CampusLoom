import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../data/principal_repository.dart';
import '../data/transport_models.dart';

class _StopRow {
  _StopRow(this.draft) : name = TextEditingController(text: draft.name);

  final StopDraft draft;
  final TextEditingController name;
}

/// Add or edit a route: name, vehicle and stops in travel order. A stop kept
/// while editing keeps its students. Pops `true` when saved or deleted.
class RouteFormScreen extends StatefulWidget {
  const RouteFormScreen({super.key, required this.vehicles, this.existing});

  final List<TransportVehicle> vehicles;
  final TransportRouteDetail? existing;

  @override
  State<RouteFormScreen> createState() => _RouteFormScreenState();
}

class _RouteFormScreenState extends State<RouteFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late String? _vehicleId = widget.existing?.vehicle?.id;
  late final List<_StopRow> _stops = widget.existing == null
      ? [_StopRow(StopDraft())]
      : [for (final stop in widget.existing!.stops) _StopRow(StopDraft.from(stop))];
  bool _saving = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    for (final row in _stops) {
      row.name.dispose();
    }
    super.dispose();
  }

  Future<void> _pickTime(_StopRow row, {required bool pickup}) async {
    final current = pickup ? row.draft.pickupTime : row.draft.dropTime;
    final parts = current?.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: parts == null
          ? TimeOfDay(hour: pickup ? 7 : 14, minute: 0)
          : TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (picked == null) return;
    setState(() {
      final text = clockText(picked.hour, picked.minute);
      if (pickup) {
        row.draft.pickupTime = text;
      } else {
        row.draft.dropTime = text;
      }
    });
  }

  void _move(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= _stops.length) return;
    setState(() {
      final row = _stops.removeAt(index);
      _stops.insert(target, row);
    });
  }

  void _remove(int index) {
    final row = _stops[index];
    setState(() => _stops.removeAt(index));
    // Its field is still mounted until this frame is built.
    WidgetsBinding.instance.addPostFrameCallback((_) => row.name.dispose());
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await action();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    for (final row in _stops) {
      row.draft.name = row.name.text;
    }
    final draft = RouteDraft(
      name: _name.text,
      vehicleId: _vehicleId,
      stops: [for (final row in _stops) row.draft],
    );
    final repository = context.read<PrincipalRepository>();
    await _run(() => repository.saveRoute(draft, id: widget.existing?.id));
  }

  Future<void> _delete() async {
    final route = widget.existing!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete route?'),
        content: Text('${route.name} will be removed and its ${route.students.length} students will have no route.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final repository = context.read<PrincipalRepository>();
    await _run(() => repository.deleteRoute(route.id));
  }

  @override
  Widget build(BuildContext context) {
    final vehicleIds = {for (final vehicle in widget.vehicles) vehicle.id};

    return Scaffold(
      appBar: AppBar(
        title: Text(_editing ? 'Edit Route' : 'Add Route'),
        actions: [
          if (_editing)
            IconButton(
              tooltip: 'Delete route',
              onPressed: _saving ? null : _delete,
              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            const SectionHeader(title: 'Route'),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Route name *', hintText: 'e.g. Route 1 - Satellite'),
              validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Give the route a name' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: vehicleIds.contains(_vehicleId) ? _vehicleId : null,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Vehicle',
                helperText: widget.vehicles.isEmpty ? 'Add a vehicle from the Vehicles tab first.' : null,
              ),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('No vehicle')),
                for (final vehicle in widget.vehicles)
                  DropdownMenuItem<String?>(
                    value: vehicle.id,
                    child: Text('${vehicle.registrationNumber} (${vehicle.capacity} seats)', overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: (value) => setState(() => _vehicleId = value),
            ),
            const SizedBox(height: 20),
            SectionHeader(title: 'Stops (${_stops.length})'),
            const Text(
              'In travel order. Times are optional.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            for (var index = 0; index < _stops.length; index++) ...[
              _StopEditor(
                key: ObjectKey(_stops[index]),
                number: index + 1,
                row: _stops[index],
                onPickTime: (pickup) => _pickTime(_stops[index], pickup: pickup),
                onUp: index == 0 ? null : () => _move(index, -1),
                onDown: index == _stops.length - 1 ? null : () => _move(index, 1),
                onRemove: () => _remove(index),
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              onPressed: () => setState(() => _stops.add(_StopRow(StopDraft()))),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Stop'),
            ),
            if (_editing)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Students at a removed stop stay on the route without a stop.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : (_editing ? 'Save Route' : 'Add Route')),
            ),
          ],
        ),
      ),
    );
  }
}

class _StopEditor extends StatelessWidget {
  const _StopEditor({
    super.key,
    required this.number,
    required this.row,
    required this.onPickTime,
    required this.onRemove,
    this.onUp,
    this.onDown,
  });

  final int number;
  final _StopRow row;
  final ValueChanged<bool> onPickTime;
  final VoidCallback onRemove;
  final VoidCallback? onUp;
  final VoidCallback? onDown;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: AppColors.primarySoft,
                child: Text('$number', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: row.name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(hintText: 'Stop name', isDense: true),
                  validator: (value) => (value?.trim().length ?? 0) < 2 ? 'Name the stop' : null,
                ),
              ),
              IconButton(tooltip: 'Move up', onPressed: onUp, icon: const Icon(Icons.arrow_upward_rounded, size: 20)),
              IconButton(tooltip: 'Move down', onPressed: onDown, icon: const Icon(Icons.arrow_downward_rounded, size: 20)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const SizedBox(width: 34),
              Expanded(child: _TimeButton(label: 'Pickup', value: row.draft.pickupTime, onTap: () => onPickTime(true))),
              const SizedBox(width: 8),
              Expanded(child: _TimeButton(label: 'Drop', value: row.draft.dropTime, onTap: () => onPickTime(false))),
              IconButton(
                tooltip: 'Remove stop',
                onPressed: onRemove,
                icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TimeButton extends StatelessWidget {
  const _TimeButton({required this.label, required this.value, required this.onTap});

  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        visualDensity: VisualDensity.compact,
      ),
      icon: const Icon(Icons.schedule_rounded, size: 16),
      label: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(value == null ? label : '$label $value'),
      ),
    );
  }
}
