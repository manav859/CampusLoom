/// One child a signed-in parent can view. Returned by GET /parent/children.
class ParentChild {
  const ParentChild({
    required this.id,
    required this.fullName,
    this.rollNumber,
    this.className,
    this.admissionNumber,
    this.profilePhotoUrl,
  });

  final String id;
  final String fullName;
  final int? rollNumber;
  final String? className;
  final String? admissionNumber;
  final String? profilePhotoUrl;

  /// "Aarav Sharma" -> "AS", for the avatar fallback.
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory ParentChild.fromJson(Map<String, dynamic> json) => ParentChild(
        id: json['id'] as String,
        fullName: (json['fullName'] ?? '') as String,
        rollNumber: json['rollNumber'] as int?,
        className: json['className'] as String?,
        admissionNumber: json['admissionNumber'] as String?,
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
      );
}
