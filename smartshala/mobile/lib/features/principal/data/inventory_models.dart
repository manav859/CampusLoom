/// One inventory item with its current stock, as the web Inventory page lists
/// it. Category/vendor management stays on the web; the app covers stock.
class InventoryItem {
  const InventoryItem({
    required this.id,
    required this.name,
    required this.unit,
    required this.type,
    required this.quantity,
    required this.reorderLevel,
    required this.lowStock,
    this.sku,
    this.location,
    this.categoryName,
    this.lastUnitCost,
  });

  final String id;
  final String name;
  final String unit;
  final String type; // CONSUMABLE | ASSET
  final int quantity;
  final int reorderLevel;
  final bool lowStock;
  final String? sku;
  final String? location;
  final String? categoryName;
  final double? lastUnitCost;

  factory InventoryItem.fromJson(Map<String, dynamic> json) => InventoryItem(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        unit: json['unit'] as String? ?? 'unit',
        type: json['type'] as String? ?? 'CONSUMABLE',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        reorderLevel: (json['reorderLevel'] as num?)?.toInt() ?? 0,
        lowStock: json['lowStock'] as bool? ?? false,
        sku: json['sku'] as String?,
        location: json['location'] as String?,
        categoryName: (json['category'] as Map?)?['name'] as String?,
        lastUnitCost: (json['lastUnitCost'] as num?)?.toDouble(),
      );
}
