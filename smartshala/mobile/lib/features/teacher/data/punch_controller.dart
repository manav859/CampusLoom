import 'package:flutter/foundation.dart';

import '../../../core/api/api_exception.dart';
import 'teacher_models.dart';
import 'teacher_repository.dart';

/// Owns today's punch state. The bar is mounted on every teacher screen, so
/// this lives above the navigator and is shared by all of them.
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
  Future<String?> punch() async {
    if (isSubmitting) return null;
    isSubmitting = true;
    notifyListeners();

    try {
      status = status.state == PunchState.notPunchedIn
          ? await _repository.punchIn()
          : await _repository.punchOut();
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
