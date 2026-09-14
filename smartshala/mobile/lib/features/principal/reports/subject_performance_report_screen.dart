import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_cards.dart';
import '../../../core/widgets/state_views.dart';
import '../data/principal_repository.dart';
import '../data/report_models.dart';
import '../widgets/management_widgets.dart';
import 'report_widgets.dart';

/// Subject Wise Performance: every class and subject's exams, results entered
/// and pending, the weighted average and the best exam average.
class SubjectPerformanceReportScreen extends StatefulWidget {
  const SubjectPerformanceReportScreen({super.key});

  @override
  State<SubjectPerformanceReportScreen> createState() => _SubjectPerformanceReportScreenState();
}

class _SubjectPerformanceReportScreenState extends State<SubjectPerformanceReportScreen> {
  late Future<List<SubjectPerformanceRow>> _future;
  String? _class;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<SubjectPerformanceRow>> _load() async =>
      subjectPerformance(await context.read<PrincipalRepository>().exams());

  Future<void> _reload() async {
    final future = _load();
    setState(() {
      _future = future;
    });
    await future.then((_) {}, onError: (Object _) {});
  }

  Future<void> _export(List<SubjectPerformanceRow> rows) => shareReportCsv(
        name: 'subject-performance',
        subject: 'Subject wise performance',
        csv: toCsv([
          ['Class', 'Subject', 'Exams', 'Results entered', 'Results pending', 'Average', 'Best exam average'],
          for (final row in rows)
            [
              row.className,
              row.subject,
              row.examCount,
              row.resultsEntered,
              row.resultsPending,
              row.average == null ? '' : '${row.average}%',
              row.bestExamAverage == null ? '' : '${row.bestExamAverage}%',
            ],
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<SubjectPerformanceRow>>(
      future: _future,
      builder: (context, snapshot) {
        final all = snapshot.data;
        final visible = all == null ? null : [for (final row in all) if (_class == null || row.className == _class) row];
        final classes = {for (final row in all ?? const <SubjectPerformanceRow>[]) row.className}.toList()..sort();

        return Scaffold(
          appBar: AppBar(
            title: const Text('Subject Wise Performance'),
            actions: [ExportCsvAction(onPressed: visible == null || visible.isEmpty ? null : () => _export(visible))],
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting) => const LoadingView(),
            AsyncSnapshot(hasError: true, :final error) => ErrorView(
                message: error is ApiException ? error.message : 'Unable to load subject performance.',
                onRetry: _reload,
              ),
            _ => RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: FilterChipButton(
                        label: _class ?? 'All Classes',
                        active: _class != null,
                        onTap: () async {
                          final picked = await pickFromSheet<String?>(
                            context,
                            title: 'Class',
                            options: [(label: 'All Classes', value: null), for (final name in classes) (label: name, value: name)],
                            selected: _class,
                          );
                          if (picked != null) setState(() => _class = picked.value);
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (visible!.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: EmptyView(
                          icon: Icons.menu_book_outlined,
                          title: 'No exams yet',
                          message: 'Subject performance appears once exams have marks.',
                        ),
                      )
                    else
                      for (final row in visible) ...[
                        AppCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(row.subject, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                    Text(
                                      [
                                        row.className,
                                        '${row.examCount} exam${row.examCount == 1 ? '' : 's'}',
                                        '${row.resultsEntered} entered',
                                        if (row.resultsPending > 0) '${row.resultsPending} pending',
                                        if (row.bestExamAverage != null) 'best ${row.bestExamAverage}%',
                                      ].join(' · '),
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              percentChip(row.average),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                  ],
                ),
              ),
          },
        );
      },
    );
  }
}
