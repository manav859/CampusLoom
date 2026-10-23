import 'package:flutter/foundation.dart';

import '../../../core/api/api_exception.dart';
import 'parent_models.dart';
import 'parent_repository.dart';

enum ParentLoadStatus { loading, ready, error }

/// Holds the signed-in parent's children and which one is currently in view.
/// Lives for the length of the session, above the Navigator, so every parent
/// screen reads the selected child from here.
class ParentSession extends ChangeNotifier {
  ParentSession(this._repository);

  final ParentRepository _repository;

  ParentLoadStatus status = ParentLoadStatus.loading;
  String? error;
  List<ParentChild> children = const [];
  ParentChild? selected;

  bool get hasMultiple => children.length > 1;

  Future<void> load() async {
    status = ParentLoadStatus.loading;
    error = null;
    notifyListeners();

    try {
      final loaded = await _repository.children();
      children = loaded;
      // One child needs no picker — drop straight into their dashboard. Keep an
      // existing valid selection across a reload.
      if (selected != null && !loaded.any((c) => c.id == selected!.id)) {
        selected = null;
      }
      selected ??= loaded.length == 1 ? loaded.first : null;
      status = ParentLoadStatus.ready;
    } on ApiException catch (e) {
      error = e.message;
      status = ParentLoadStatus.error;
    }
    notifyListeners();
  }

  void select(ParentChild child) {
    selected = child;
    notifyListeners();
  }

  /// Back to the picker — only meaningful when there is more than one child.
  void changeChild() {
    if (!hasMultiple) return;
    selected = null;
    notifyListeners();
  }
}
