import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/brand_header.dart';

String? _validateMobile(String? value) {
  final mobile = (value ?? '').trim();
  if (mobile.isEmpty) return 'Enter your mobile number';
  if (!RegExp(r'^[0-9]{10}$').hasMatch(mobile)) return 'Enter a valid 10-digit mobile number';
  return null;
}

String? _validateAdmission(String? value) {
  final admission = (value ?? '').trim();
  if (admission.isEmpty) return "Enter your child's SR / admission number";
  return null;
}

/// The Parent app's sign-in: the parent's mobile number and any one of their
/// children's SR (admission) number. The server finds the school and the
/// children from these alone — no account to provision.
class ParentLoginScreen extends StatefulWidget {
  const ParentLoginScreen({super.key});

  @override
  State<ParentLoginScreen> createState() => _ParentLoginScreenState();
}

class _ParentLoginScreenState extends State<ParentLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mobile = TextEditingController();
  final _admission = TextEditingController();

  @override
  void dispose() {
    _mobile.dispose();
    _admission.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    await context.read<AuthController>().parentLogin(
          mobile: _mobile.text,
          admissionNumber: _admission.text,
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
                      'Welcome',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      "Sign in with your mobile number and your child's SR number",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.4),
                    ),
                    const SizedBox(height: 28),
                    _Field(
                      label: 'Mobile number',
                      controller: _mobile,
                      hint: '10-digit mobile number',
                      icon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      validator: _validateMobile,
                    ),
                    const SizedBox(height: 16),
                    _Field(
                      label: 'SR / Admission number',
                      controller: _admission,
                      hint: "Your child's SR number",
                      icon: Icons.badge_outlined,
                      textCapitalization: TextCapitalization.characters,
                      onSubmitted: (_) => _submit(),
                      validator: _validateAdmission,
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
                              child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                            )
                          : const Text('Sign in'),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Your SR number is on your fee receipt or report card. '
                      'Ask your school office if you cannot find it.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.4),
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
}

class _Logo extends StatelessWidget {
  const _Logo({required this.portalLabel});

  final String portalLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const BrandLogo(size: 64),
        const SizedBox(height: 14),
        const Text(
          'SmartShala',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
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

class _BackendNotice extends StatelessWidget {
  const _BackendNotice({required this.baseUrl});

  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: AppColors.warningSoft, borderRadius: BorderRadius.circular(8)),
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
    this.keyboardType,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final void Function(String)? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 7),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          textCapitalization: textCapitalization,
          onFieldSubmitted: onSubmitted,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 20, color: AppColors.textMuted),
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
