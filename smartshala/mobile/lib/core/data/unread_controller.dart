import 'package:flutter/foundation.dart';

/// The number on the app bar's notification bell, shared by the whole session.
///
/// Home and Messages are siblings in an IndexedStack, so Home stays alive and
/// never rebuilds while Messages is on screen. Each kept its own copy of the
/// count before, which meant reading an announcement left the bell showing the
/// old number until Home was pulled to refresh. One count, held above both,
/// is what keeps them honest.
class UnreadController extends ChangeNotifier {
  int _count = 0;

  int get count => _count;

  /// The count as a freshly loaded screen found it on the server.
  void setCount(int value) {
    final next = value < 0 ? 0 : value;
    if (next == _count) return;
    _count = next;
    notifyListeners();
  }

  /// One announcement has been opened. The bell drops immediately rather than
  /// waiting for the next load, matching the optimistic update in the list.
  void markOneRead() {
    if (_count == 0) return;
    _count--;
    notifyListeners();
  }
}
