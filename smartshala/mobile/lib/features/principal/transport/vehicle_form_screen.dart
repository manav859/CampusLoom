import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../data/principal_repository.dart';
import '../data/transport_models.dart';

/// Add or edit a vehicle and its driver. Pops `true` when saved or deleted.
class VehicleFormScreen extends StatefulWidget {
  const VehicleFormScreen({super.key, this.existing});

  final TransportVehicle? existing;

  @override
  State<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends State<VehicleFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _registration = TextEditingController(text: widget.existing?.registrationNumber ?? '');
  late final _capacity = TextEditingController(text: widget.existing?.capacity.toString() ?? '');
  late final _driverName = TextEditingController(text: widget.existing?.driverName ?? '');
  late final _driverPhone = TextEditingController(text: widget.existing?.driverPhone ?? '');
  bool _saving = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void dispose() {
    for (final controller in [_registration, _capacity, _driverName, _driverPhone]) {
      controller.dispose();
    }
    super.dispose();
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
    final draft = VehicleDraft(
      registrationNumber: _registration.text,
      capacity: int.parse(_capacity.text.trim()),
      driverName: _driverName.text,
      driverPhone: _driverPhone.text,
    );
    final repository = context.read<PrincipalRepository>();
    await _run(() => _editing ? repository.updateVehicle(widget.existing!.id, draft) : repository.createVehicle(draft));
  }

  Future<void> _delete() async {
    final vehicle = widget.existing!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete vehicle?'),
        content: Text('${vehicle.registrationNumber} will be removed. Routes using it will have no vehicle.'),
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
    await _run(() => repository.deleteVehicle(vehicle.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_editing ? 'Edit Vehicle' : 'Add Vehicle'),
        actions: [
          if (_editing)
            IconButton(
              tooltip: 'Delete vehicle',
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
            const SectionHeader(title: 'Vehicle'),
            TextFormField(
              controller: _registration,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'Registration number *', hintText: 'e.g. GJ01AB1234'),
              validator: (value) => (value?.trim().length ?? 0) < 4 ? 'Enter the registration number' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _capacity,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'Seats *'),
              validator: (value) {
                final number = int.tryParse(value?.trim() ?? '');
                return number == null || number < 1 ? 'At least 1 seat' : null;
              },
            ),
            const SizedBox(height: 20),
            const SectionHeader(title: 'Driver'),
            TextFormField(
              controller: _driverName,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Driver name'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _driverPhone,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              decoration: const InputDecoration(labelText: 'Driver phone'),
              validator: (value) {
                final text = value?.trim() ?? '';
                return text.isNotEmpty && text.length != 10 ? 'Use a 10-digit phone number' : null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : (_editing ? 'Save Vehicle' : 'Add Vehicle')),
            ),
          ],
        ),
      ),
    );
  }
}
