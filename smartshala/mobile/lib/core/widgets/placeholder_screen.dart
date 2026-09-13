import 'package:flutter/material.dart';

import 'state_views.dart';

/// Destination for modules that are mapped in navigation but land in a later
/// phase. Keeps the Home -> More -> Detail flows walkable end to end.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.icon,
    this.phase,
  });

  final String title;
  final IconData icon;
  final String? phase;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: EmptyView(
        icon: icon,
        title: title,
        message: phase == null
            ? 'This section arrives in a later phase of the V2 rollout.'
            : 'Planned for $phase of the V2 rollout.',
      ),
    );
  }
}
