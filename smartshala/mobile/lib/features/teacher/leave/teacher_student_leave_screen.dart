import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/student_leave_approval_screen.dart';
import '../data/teacher_repository.dart';

/// A class teacher's student-leave queue: the same screen the office uses,
/// holding only the classes this teacher is class teacher of. The scoping is
/// the server's — see the student-leave router.
class TeacherStudentLeaveScreen extends StatelessWidget {
  const TeacherStudentLeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<TeacherRepository>();
    return StudentLeaveApprovalScreen(
      load: repository.studentLeave,
      decide: repository.decideStudentLeave,
    );
  }
}
