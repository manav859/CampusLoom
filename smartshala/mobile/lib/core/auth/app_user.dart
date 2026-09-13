class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.role,
    required this.schoolName,
    this.email,
    this.phone,
    this.academicBackground,
  });

  final String id;
  final String fullName;
  final String role;
  final String schoolName;
  final String? email;
  final String? phone;
  final String? academicBackground;

  bool get isTeacher => role == 'TEACHER';
  bool get isPrincipal => role == 'PRINCIPAL' || role == 'ADMIN';

  /// "Amit Verma" -> "AV", used for the avatar fallback.
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        fullName: (json['fullName'] ?? json['name'] ?? '') as String,
        role: json['role'] as String,
        schoolName: (json['schoolName'] ?? '') as String,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        academicBackground: json['academicBackground'] as String?,
      );
}
