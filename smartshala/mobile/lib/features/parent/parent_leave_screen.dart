import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';

/// A child's leave requests: the list of what the parent has raised with its
/// status, and a form to raise a new one. Approval happens at the school — this
/// screen only submits and tracks.
class ParentLeaveScreen extends StatefulWidget {
  const ParentLeaveScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentLeaveScreen> createState() => _ParentLeaveScreenState();
}

class _ParentLeaveScreenState extends State<ParentLeaveScreen> {
  List<ParentLeaveRequest>? _data;
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
      final data = await context.read<ParentRepository>().leaveRequests(widget.childId);
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

  Future<void> _openForm() async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _LeaveForm(childId: widget.childId),
    );
    if (submitted == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Leave Requests'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(widget.childName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openForm,
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Request leave'),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _content(_data!),
      ),
    );
  }

  Widget _content(List<ParentLeaveRequest> requests) {
    if (requests.isEmpty) {
      return const EmptyView(
        icon: Icons.event_busy_rounded,
        title: 'No leave requests yet',
        message: 'Raise a leave request for your child and the school will review it.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
      itemCount: requests.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _LeaveCard(request: requests[i]),
    );
  }
}

({Color fg, Color bg, String label}) _statusStyle(String status) => switch (status) {
      'APPROVED' => (fg: AppColors.success, bg: AppColors.successSoft, label: 'Approved'),
      'REJECTED' => (fg: AppColors.danger, bg: AppColors.dangerSoft, label: 'Rejected'),
      'CANCELLED' => (fg: AppColors.textSecondary, bg: AppColors.border, label: 'Cancelled'),
      _ => (fg: AppColors.warning, bg: AppColors.warningSoft, label: 'Pending'),
    };

String _range(DateTime from, DateTime to) {
  final fmt = DateFormat('d MMM yyyy');
  final start = fmt.format(from);
  return from == to ? start : '$start – ${fmt.format(to)}';
}

class _LeaveCard extends StatelessWidget {
  const _LeaveCard({required this.request});

  final ParentLeaveRequest request;

  @override
  Widget build(BuildContext context) {
    final style = _statusStyle(request.status);
    return HomeSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _range(request.fromDate, request.toDate),
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(20)),
                child: Text(style.label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: style.fg)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${request.days} ${request.days == 1 ? 'day' : 'days'}',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: 8),
          Text(request.reason, style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary)),
          if (request.decisionNote != null && request.decisionNote!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(10)),
              child: Text(
                'School: ${request.decisionNote!}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The bottom-sheet form for raising a new request. Pops `true` on success.
class _LeaveForm extends StatefulWidget {
  const _LeaveForm({required this.childId});

  final String childId;

  @override
  State<_LeaveForm> createState() => _LeaveFormState();
}

class _LeaveFormState extends State<_LeaveForm> {
  final _reason = TextEditingController();
  DateTime? _from;
  DateTime? _to;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick({required bool isFrom}) async {
    final now = DateTime.now();
    final initial = isFrom ? (_from ?? now) : (_to ?? _from ?? now);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _from = picked;
        if (_to != null && _to!.isBefore(picked)) _to = picked;
      } else {
        _to = picked;
      }
    });
  }

  Future<void> _submit() async {
    final reason = _reason.text.trim();
    if (_from == null || _to == null) {
      setState(() => _error = 'Pick the leave dates.');
      return;
    }
    if (reason.length < 5) {
      setState(() => _error = 'Give a reason of at least 5 characters.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    final fmt = DateFormat('yyyy-MM-dd');
    try {
      await context.read<ParentRepository>().submitLeave(
            widget.childId,
            fromDate: fmt.format(_from!),
            toDate: fmt.format(_to!),
            reason: reason,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM yyyy');
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Request leave', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _DateField(label: 'From', value: _from == null ? null : fmt.format(_from!), onTap: () => _pick(isFrom: true))),
              const SizedBox(width: 12),
              Expanded(child: _DateField(label: 'To', value: _to == null ? null : fmt.format(_to!), onTap: () => _pick(isFrom: false))),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _reason,
            maxLines: 3,
            maxLength: 500,
            decoration: const InputDecoration(
              labelText: 'Reason',
              hintText: 'Why will your child be absent?',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 4),
            Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14)),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit request'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap});

  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        child: Text(
          value ?? 'Select',
          style: TextStyle(fontSize: 14, color: value == null ? AppColors.textMuted : AppColors.textPrimary),
        ),
      ),
    );
  }
}
