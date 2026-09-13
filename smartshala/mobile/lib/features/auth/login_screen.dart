import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';

/// Requests are routed on `/{schoolCode}/api/v1/...` and the server rejects
/// anything that is not eight uppercase letters or digits, so a malformed code
/// can be caught here instead of costing a round trip.
final _schoolCodePattern = RegExp(r'^[A-Z0-9]{8}$');

/// Login matches the identifier against `email` or `phone` exactly, and phone
/// numbers are stored as ten digits.
final _emailPattern = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$');
final _phonePattern = RegExp(r'^[0-9]{10}$');

String? validateSchoolCode(String? value) {
  final code = (value ?? '').trim().toUpperCase();
  if (code.isEmpty) return 'Enter your school code';
  if (!_schoolCodePattern.hasMatch(code)) {
    return 'School code is 8 letters or numbers, e.g. SS000001';
  }
  return null;
}

String? validateIdentifier(String? value) {
  final identifier = (value ?? '').trim();
  if (identifier.isEmpty) return 'Enter your email or phone';
  if (_emailPattern.hasMatch(identifier) || _phonePattern.hasMatch(identifier)) {
    return null;
  }
  return 'Enter a valid email address or 10-digit phone number';
}

String? validatePassword(String? value) {
  final password = value ?? '';
  if (password.isEmpty) return 'Enter your password';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 72) return 'Password cannot be longer than 72 characters';
  return null;
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolCode = TextEditingController();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    // The tenant code survives sign-out, so a returning user only types
    // credentials.
    _schoolCode.text = context.read<AuthController>().schoolCode ?? '';
  }

  @override
  void dispose() {
    _schoolCode.dispose();
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    await context.read<AuthController>().login(
          schoolCodeInput: _schoolCode.text,
          identifier: _identifier.text,
          password: _password.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();
    final auth = context.watch<AuthController>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                // Once a field has been touched, correcting it clears its error
                // without waiting for another tap on Sign in.
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Logo(portalLabel: config.portalLabel),
                    if (config.isUsingCustomBackend) ...[
                      const SizedBox(height: 14),
                      _BackendNotice(baseUrl: config.apiBaseUrl),
                    ],
                    const SizedBox(height: 32),
                    const Text(
                      'Welcome back',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Sign in to continue to your ${config.isPrincipal ? 'school' : 'classes'}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                    ),
                    const SizedBox(height: 28),
                    _Field(
                      label: 'School code',
                      controller: _schoolCode,
                      hint: 'e.g. SS000001',
                      icon: Icons.apartment_rounded,
                      textCapitalization: TextCapitalization.characters,
                      validator: validateSchoolCode,
                    ),
                    const SizedBox(height: 16),
                    _Field(
                      label: 'Email or phone',
                      controller: _identifier,
                      hint: 'you@school.edu.in',
                      icon: Icons.person_outline_rounded,
                      keyboardType: TextInputType.emailAddress,
                      validator: validateIdentifier,
                    ),
                    const SizedBox(height: 16),
                    _Field(
                      label: 'Password',
                      controller: _password,
                      hint: 'Your password',
                      icon: Icons.lock_outline_rounded,
                      obscureText: _obscurePassword,
                      onSubmitted: (_) => _submit(),
                      suffix: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      validator: validatePassword,
                    ),
                    if (auth.errorMessage != null) ...[
                      const SizedBox(height: 18),
                      _ErrorBanner(message: auth.errorMessage!),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: auth.isSubmitting ? null : _submit,
                      child: auth.isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Sign in'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: auth.isSubmitting ? null : _showForgotPassword,
                      child: const Text('Forgot password?'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showForgotPassword() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Forgot password'),
        content: const Text(
          'Password resets are handled by your school office. Please contact your '
          'principal or school admin to have your password reset.',
          style: TextStyle(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.portalLabel});

  final String portalLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(20),
          ),
          alignment: Alignment.center,
          child: const Text(
            'Ss',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 26),
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'SmartShala',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        Text(
          portalLabel,
          style: const TextStyle(
            fontSize: 10,
            letterSpacing: 1.6,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

/// Only shown when API_BASE_URL was overridden away from the deployed backend.
class _BackendNotice extends StatelessWidget {
  const _BackendNotice({required this.baseUrl});

  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        'Custom backend: $baseUrl',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, color: AppColors.warning),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.icon,
    this.hint,
    this.validator,
    this.obscureText = false,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.suffix,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String? hint;
  final String? Function(String?)? validator;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final Widget? suffix;
  final void Function(String)? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 7),
        TextFormField(
          controller: controller,
          validator: validator,
          obscureText: obscureText,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          onFieldSubmitted: onSubmitted,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 20, color: AppColors.textMuted),
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.danger, fontSize: 13, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
