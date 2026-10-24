import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/home_blocks.dart';
import '../../core/widgets/state_views.dart';
import 'data/parent_models.dart';
import 'data/parent_repository.dart';

/// A child's documents — report cards, certificates and the like. Read + open:
/// tapping one fetches a short-lived download URL and opens it in a browser tab
/// (Apple-safe, like the fee flow).
class ParentDocumentsScreen extends StatefulWidget {
  const ParentDocumentsScreen({super.key, required this.childId, required this.childName});

  final String childId;
  final String childName;

  @override
  State<ParentDocumentsScreen> createState() => _ParentDocumentsScreenState();
}

class _ParentDocumentsScreenState extends State<ParentDocumentsScreen> {
  List<ParentDocument>? _data;
  String? _error;
  bool _loading = true;
  String? _openingId;

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
      final data = await context.read<ParentRepository>().documents(widget.childId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _toast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.textPrimary,
      ));
  }

  Future<void> _open(ParentDocument document) async {
    setState(() => _openingId = document.id);
    try {
      final url = await context.read<ParentRepository>().documentDownloadUrl(widget.childId, document.id);
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened) _toast('Could not open the document.', isError: true);
    } catch (e) {
      _toast(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _openingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Documents & Certificates'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(widget.childName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _content(_data!),
      ),
    );
  }

  Widget _content(List<ParentDocument> documents) {
    if (documents.isEmpty) {
      return const EmptyView(
        icon: Icons.folder_open_rounded,
        title: 'No documents yet',
        message: 'Report cards and certificates shared by the school will appear here.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      itemCount: documents.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _DocumentCard(
        document: documents[i],
        opening: _openingId == documents[i].id,
        onOpen: _openingId == null ? () => _open(documents[i]) : null,
      ),
    );
  }
}

/// A human size — "840 KB", "2.1 MB".
String _formatSize(int bytes) {
  if (bytes <= 0) return '';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({required this.document, required this.opening, this.onOpen});

  final ParentDocument document;
  final bool opening;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final meta = [
      document.typeLabel,
      if (document.uploadedAt != null) DateFormat('d MMM yyyy').format(document.uploadedAt!),
      if (_formatSize(document.sizeBytes).isNotEmpty) _formatSize(document.sizeBytes),
    ].join('  ·  ');

    return HomeSurface(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      onTap: onOpen,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.description_rounded, size: 21, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.name.isEmpty ? document.originalName : document.name,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(meta, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          opening
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : IconButton(
                  onPressed: onOpen,
                  icon: const Icon(Icons.open_in_new_rounded, color: AppColors.primary),
                  tooltip: 'Open document',
                ),
        ],
      ),
    );
  }
}
