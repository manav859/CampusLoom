import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/school_models.dart';
import '../data/student_models.dart' show ClassChoice;
import '../data/transport_models.dart';

/// Pick a class, tick its students and choose their stop. Students already on
/// another route move to this one. Pops the number added.
class AssignStudentsScreen extends StatefulWidget {
  const AssignStudentsScreen({super.key, required this.route});

  final TransportRouteDetail route;

  @override
  State<AssignStudentsScreen> createState() => _AssignStudentsScreenState();
}

class _AssignStudentsScreenState extends State<AssignStudentsScreen> {
  late Future<List<ClassChoice>> _classes;
  Future<List<ClassStudent>>? _students;
  String? _classId;
  late String? _stopId = widget.route.stops.firstOrNull?.id;
  final Set<String> _picked = {};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _classes = context.read<PrincipalRepository>().classes();
  }

  void _chooseClass(String? classId) {
    setState(() {
      _classId = classId;
      _picked.clear();
      _students = classId == null ? null : context.read<PrincipalRepository>().classStudents(classId);
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await context.read<PrincipalRepository>().assignToRoute(
            studentIds: _picked.toList(),
            routeId: widget.route.id,
            stopId: _stopId,
          );
      if (mounted) Navigator.of(context).pop(_picked.length);
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: AppColors.danger, content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final onRoute = {for (final student in widget.route.students) student.id};

    return Scaffold(
      appBar: AppBar(title: Text('Add to ${widget.route.name}')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _picked.isEmpty || _saving ? null : _save,
            child: Text(_saving
                ? 'Adding…'
                : _picked.isEmpty
                    ? 'Choose students'
                    : 'Add ${_picked.length} ${_picked.length == 1 ? 'student' : 'students'}'),
          ),
        ),
      ),
      body: FutureBuilder<List<ClassChoice>>(
        future: _classes,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorView(
              message: error is ApiException ? error.message : 'Could not load classes.',
              onRetry: () => setState(() {
                _classes = context.read<PrincipalRepository>().classes();
              }),
            );
          }
          final classes = snapshot.data!;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              DropdownButtonFormField<String>(
                initialValue: _classId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Class'),
                items: [for (final item in classes) DropdownMenuItem(value: item.id, child: Text(item.label))],
                onChanged: _chooseClass,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: _stopId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Stop'),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('No stop yet')),
                  for (final stop in widget.route.stops)
                    DropdownMenuItem<String?>(value: stop.id, child: Text('${stop.sequence}. ${stop.name}')),
                ],
                onChanged: (value) => setState(() => _stopId = value),
              ),
              const SizedBox(height: 6),
              const Text(
                'Students already on another route move to this one.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 14),
              if (_students == null)
                const AppCard(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: EmptyView(icon: Icons.grid_view_rounded, title: 'Choose a class'),
                )
              else
                FutureBuilder<List<ClassStudent>>(
                  future: _students,
                  builder: (context, studentsSnapshot) {
                    if (studentsSnapshot.connectionState == ConnectionState.waiting) {
                      return const Padding(padding: EdgeInsets.all(24), child: LoadingView());
                    }
                    if (studentsSnapshot.hasError) {
                      final error = studentsSnapshot.error;
                      return ErrorView(
                        message: error is ApiException ? error.message : 'Could not load students.',
                        onRetry: () => _chooseClass(_classId),
                      );
                    }
                    final available = studentsSnapshot.data!.where((student) => !onRoute.contains(student.id)).toList();
                    if (available.isEmpty) {
                      return const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyView(icon: Icons.check_circle_outline_rounded, title: 'Everyone in this class is on this route'),
                      );
                    }
                    final allPicked = available.every((student) => _picked.contains(student.id));

                    return AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          CheckboxListTile(
                            value: allPicked,
                            title: Text('Select all (${available.length})', style: const TextStyle(fontWeight: FontWeight.w600)),
                            onChanged: (_) => setState(() {
                              if (allPicked) {
                                _picked.removeAll(available.map((student) => student.id));
                              } else {
                                _picked.addAll(available.map((student) => student.id));
                              }
                            }),
                          ),
                          const Divider(height: 1),
                          for (final student in available)
                            CheckboxListTile(
                              value: _picked.contains(student.id),
                              title: Text(student.fullName),
                              subtitle: Text(student.rollNumber == null ? student.admissionNumber : 'Roll ${student.rollNumber}'),
                              onChanged: (_) => setState(() {
                                if (!_picked.remove(student.id)) _picked.add(student.id);
                              }),
                            ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}
