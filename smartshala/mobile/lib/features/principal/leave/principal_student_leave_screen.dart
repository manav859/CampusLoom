import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/student_leave_approval_screen.dart';
import '../data/principal_repository.dart';

/// The office's student-leave queue: the shared screen, reading the whole
/// school through the principal's repository.
class PrincipalStudentLeaveScreen extends StatelessWidget {
  const PrincipalStudentLeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<PrincipalRepository>();
    return StudentLeaveApprovalScreen(
      load: repository.studentLeave,
      decide: repository.decideStudentLeave,
    );
  }
}
