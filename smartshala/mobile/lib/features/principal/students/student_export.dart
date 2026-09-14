import '../data/student_models.dart';

/// The web Students page's CSV export (`exportSelectedCsv`): the same columns,
/// the same values, every cell quoted with embedded quotes doubled.
String studentsCsv(List<StudentRow> students) {
  String cell(Object? value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
  String number(double? value) => value == null
      ? ''
      : value == value.roundToDouble()
          ? value.toInt().toString()
          : value.toString();

  final rows = [
    ['Admission No', 'Student Name', 'Class', 'Parent Phone', 'Fee Status', 'Pending Amount', 'Attendance'],
    for (final student in students)
      [
        student.admissionNumber,
        student.fullName,
        student.className,
        student.parentPhone ?? '',
        student.feeStatus?.apiValue.toLowerCase() ?? '',
        number(student.pendingAmount),
        student.attendancePercentage == null ? '' : '${student.attendancePercentage}%',
      ],
  ];

  return rows.map((row) => row.map(cell).join(',')).join('\n');
}
