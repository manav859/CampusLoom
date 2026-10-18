import 'package:flutter/material.dart';

/// Lets the screens inside a shell ask to be taken back to the Home tab.
///
/// A bottom-tab root is not on the navigator stack, so there is nothing for a
/// back arrow to pop. The shell puts its own "show Home" callback here and
/// [AppBackButton] falls back to it.
class HomeTabScope extends InheritedWidget {
  const HomeTabScope({super.key, required this.goHome, required super.child});

  final VoidCallback goHome;

  static VoidCallback? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<HomeTabScope>()?.goHome;

  @override
  bool updateShouldNotify(HomeTabScope oldWidget) => goHome != oldWidget.goHome;
}

/// The back arrow every screen but Home carries.
///
/// Pushed screens pop, which is what Flutter's implicit leading already does —
/// this exists for the screens it cannot help: a tab root has an empty stack,
/// so it goes to the Home tab instead of leaving the user with no way out but
/// the bottom bar. One widget covers both because several screens are reached
/// each way (the calendar is a tab and a Quick Action).
class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key});

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    final goHome = HomeTabScope.maybeOf(context);
    if (!canPop && goHome == null) return const SizedBox.shrink();

    return BackButton(
      onPressed: canPop ? () => Navigator.of(context).pop() : goHome,
    );
  }
}
