import 'package:flutter/foundation.dart';

import '../../../core/api/api_exception.dart';
import 'teacher_models.dart';
import 'teacher_repository.dart';

/// What a teacher can do to today's punch from where it stands.
enum PunchStep {
  /// Starts the day, ends a break, or re-opens a day punched out by mistake.
  punchIn,
  takeBreak,
  punchOut,
}

/// Owns today's punch state. It lives above the navigator, so Home's punch
/// card and anything else reading it share one copy.
class PunchController extends ChangeNotifier {
  PunchController(this._repository);

  final TeacherRepository _repository;

  PunchStatus status = PunchStatus.empty;
  bool isLoading = true;
  bool isSubmitting = false;
  String? lastError;

  Future<void> load() async {
    isLoading = true;
    notifyListeners();
    try {
      status = await _repository.punchStatus();
      lastError = null;
    } on ApiException catch (error) {
      lastError = error.message;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Returns the message to surface to the teacher, or null when it worked.
  Future<String?> run(PunchStep step) async {
    if (isSubmitting) return null;
    isSubmitting = true;
    notifyListeners();

    try {
      status = switch (step) {
        PunchStep.punchIn => await _repository.punchIn(),
        PunchStep.takeBreak => await _repository.startBreak(),
        PunchStep.punchOut => await _repository.punchOut(),
      };
      lastError = null;
      return null;
    } on ApiException catch (error) {
      // A 409 means the server and this device disagree about today's state
      // (a second device, or a stale screen). Re-read rather than guess.
      if (error.statusCode == 409) await _refreshQuietly();
      lastError = error.message;
      return error.message;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  Future<void> _refreshQuietly() async {
    try {
      status = await _repository.punchStatus();
    } on ApiException {
      // Keep the last known state; the error from the punch call is reported.
    }
  }
}
