import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/app_chips.dart';
import '../../../core/widgets/state_views.dart';
import '../data/inventory_models.dart';
import '../data/principal_repository.dart';

/// Inventory — browse items with their current stock, and record stock received
/// (in) or issued (out). Categories, vendors and new items are managed on web.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<InventoryItem> _items = [];
  String _search = '';
  bool _lowStockOnly = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final items = await context.read<PrincipalRepository>().inventoryItems(search: _search, lowStock: _lowStockOnly);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _openStockSheet(InventoryItem item) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _StockSheet(item: item),
    );
    if (changed == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              textInputAction: TextInputAction.search,
              onSubmitted: (value) {
                setState(() => _search = value);
                _load();
              },
              decoration: const InputDecoration(
                hintText: 'Search items',
                prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: FilterChip(
                label: const Text('Low stock only'),
                selected: _lowStockOnly,
                onSelected: (value) {
                  setState(() => _lowStockOnly = value);
                  _load();
                },
              ),
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView(message: 'Loading inventory…');
    if (_error != null) {
      return ListView(children: [const SizedBox(height: 80), ErrorView(message: _error!, onRetry: _load)]);
    }
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 80),
            EmptyView(
              icon: Icons.inventory_2_outlined,
              title: _lowStockOnly ? 'No low-stock items' : 'No items',
              message: _search.isNotEmpty
                  ? 'No item matches "$_search".'
                  : 'Add items on the web dashboard, then record stock here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _ItemCard(item: _items[index], onTap: () => _openStockSheet(_items[index])),
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item, required this.onTap});

  final InventoryItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = <String>[
      if (item.categoryName != null && item.categoryName!.isNotEmpty) item.categoryName!,
      if (item.sku != null && item.sku!.isNotEmpty) 'SKU ${item.sku}',
      if (item.location != null && item.location!.isNotEmpty) item.location!,
    ];

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.name,
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                    ),
                    if (item.lowStock) ...[
                      const SizedBox(width: 8),
                      StatusChip(label: 'Low', color: AppColors.danger, tint: AppColors.dangerSoft),
                    ],
                  ],
                ),
                if (subtitleParts.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(subtitleParts.join(' • '), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${item.quantity}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: item.lowStock ? AppColors.danger : AppColors.textPrimary,
                ),
              ),
              Text(item.unit, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ],
          ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

/// A bottom sheet to record stock received (PURCHASE) or issued (ISSUE).
class _StockSheet extends StatefulWidget {
  const _StockSheet({required this.item});

  final InventoryItem item;

  @override
  State<_StockSheet> createState() => _StockSheetState();
}

class _StockSheetState extends State<_StockSheet> {
  bool _isIn = true; // true = received (PURCHASE), false = issued (ISSUE)
  final _quantity = TextEditingController();
  final _extra = TextEditingController(); // unit cost (in) or issued-to (out)
  final _note = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _quantity.dispose();
    _extra.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final quantity = int.tryParse(_quantity.text.trim());
    if (quantity == null || quantity < 1) {
      setState(() => _error = 'Enter a quantity of at least 1.');
      return;
    }
    if (!_isIn && quantity > widget.item.quantity) {
      setState(() => _error = 'Only ${widget.item.quantity} ${widget.item.unit} in stock.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<PrincipalRepository>().recordInventoryTransaction(
            itemId: widget.item.id,
            type: _isIn ? 'PURCHASE' : 'ISSUE',
            quantity: quantity,
            unitCost: _isIn ? double.tryParse(_extra.text.trim()) : null,
            issuedTo: _isIn ? null : _extra.text,
            note: _note.text,
          );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('In stock: ${item.quantity} ${item.unit}', style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Stock In'), icon: Icon(Icons.south_west_rounded, size: 16)),
              ButtonSegment(value: false, label: Text('Stock Out'), icon: Icon(Icons.north_east_rounded, size: 16)),
            ],
            selected: {_isIn},
            onSelectionChanged: (value) => setState(() => _isIn = value.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _quantity,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'Quantity (${item.unit})'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _extra,
            keyboardType: _isIn ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
            decoration: InputDecoration(labelText: _isIn ? 'Unit cost (optional)' : 'Issued to (optional)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Note (optional)'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _isIn ? AppColors.success : AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : Text(_isIn ? 'Record Stock In' : 'Record Stock Out'),
            ),
          ),
        ],
      ),
    );
  }
}
