import 'package:flutter/material.dart';

import '../data/exam_models.dart';

/// Marks for one student, or absent.
class MarksEntry {
  const MarksEntry({required this.marks, required this.isAbsent});

  final double marks;
  final bool isAbsent;
}

/// Enters one student's marks, capped at the exam's maximum. Pops a
/// [MarksEntry], or nothing when cancelled.
class MarksEntryDialog extends StatefulWidget {
  const MarksEntryDialog({super.key, required this.student, required this.maxMarks});

  final ExamStudentResult student;
  final double maxMarks;

  @override
  State<MarksEntryDialog> createState() => _MarksEntryDialogState();
}

class _MarksEntryDialogState extends State<MarksEntryDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.student.marks?.toStringAsFixed(0) ?? '');
  late bool _isAbsent = widget.student.isAbsent;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    if (_isAbsent) {
      Navigator.of(context).pop(const MarksEntry(marks: 0, isAbsent: true));
      return;
    }

    final marks = double.tryParse(_controller.text.trim());
    if (marks == null || marks < 0) {
      setState(() => _error = 'Enter a number of marks');
      return;
    }
    if (marks > widget.maxMarks) {
      setState(() => _error = 'Cannot exceed ${widget.maxMarks.toStringAsFixed(0)}');
      return;
    }

    Navigator.of(context).pop(MarksEntry(marks: marks, isAbsent: false));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: Text(widget.student.fullName),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            autofocus: !_isAbsent,
            enabled: !_isAbsent,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Marks out of ${widget.maxMarks.toStringAsFixed(0)}',
              errorText: _error,
            ),
            onChanged: (_) => setState(() => _error = null),
          ),
          const SizedBox(height: 6),
          CheckboxListTile(
            value: _isAbsent,
            onChanged: (value) => setState(() => _isAbsent = value ?? false),
            title: const Text('Marked absent', style: TextStyle(fontSize: 14)),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _save,
          style: FilledButton.styleFrom(minimumSize: const Size(88, 42)),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
