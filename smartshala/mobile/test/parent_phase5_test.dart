import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/calendar_models.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_models.dart';
import 'package:smartshala_mobile/features/parent/data/parent_repository.dart';
import 'package:smartshala_mobile/features/parent/parent_announcements_screen.dart';
import 'package:smartshala_mobile/features/parent/parent_calendar_screen.dart';
import 'package:smartshala_mobile/features/parent/parent_documents_screen.dart';

class _FakeParentRepository extends Fake implements ParentRepository {
  @override
  Future<List<CalendarEvent>> calendar(DateTime month) async => [
        CalendarEvent(
          id: 'e1',
          type: CalendarEventType.holiday,
          title: 'Diwali Holiday',
          startDate: DateTime(month.year, month.month, 12),
          endDate: DateTime(month.year, month.month, 12),
        ),
        CalendarEvent(
          id: 'e2',
          type: CalendarEventType.exam,
          title: 'Half-Yearly Exam',
          startDate: DateTime(month.year, month.month, 20),
          endDate: DateTime(month.year, month.month, 24),
        ),
      ];

  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async => AnnouncementPage(
        items: [
          Announcement(
            id: 'a1',
            title: 'Parent-Teacher Meeting',
            body: 'The PTM is scheduled for Saturday.',
            audience: AnnouncementAudience.parents,
            priority: AnnouncementPriority.important,
            publishedAt: DateTime(2026, 10, 20),
            isRead: true,
            postedByName: 'Principal',
          ),
        ],
        total: 1,
        unreadCount: 0,
        hasMore: false,
      );

  @override
  Future<List<ParentDocument>> documents(String childId) async => [
        ParentDocument(
          id: 'd1',
          type: 'REPORT_CARD',
          name: 'Term 1 Report Card',
          originalName: 'report.pdf',
          sizeBytes: 240 * 1024,
          mimeType: 'application/pdf',
          uploadedAt: DateTime(2026, 9, 15),
        ),
      ];
}

Widget _wrap(Widget child) => Provider<ParentRepository>.value(
      value: _FakeParentRepository(),
      child: MaterialApp(home: Scaffold(body: child)),
    );

void main() {
  testWidgets('calendar lists the month\'s events with their type', (tester) async {
    await tester.pumpWidget(_wrap(const ParentCalendarScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Diwali Holiday'), findsOneWidget);
    expect(find.text('Half-Yearly Exam'), findsOneWidget);
    expect(find.text('Holiday'), findsOneWidget);
    expect(find.text('Exam'), findsOneWidget);
  });

  testWidgets('announcements feed shows a parent notice', (tester) async {
    await tester.pumpWidget(_wrap(const ParentAnnouncementsScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Parent-Teacher Meeting'), findsOneWidget);
    expect(find.textContaining('PTM'), findsOneWidget);
  });

  testWidgets('documents lists a downloadable report card', (tester) async {
    await tester.pumpWidget(_wrap(
      const ParentDocumentsScreen(childId: 'a', childName: 'Aarav Sharma'),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Term 1 Report Card'), findsOneWidget);
    expect(find.textContaining('Report Card'), findsWidgets);
    expect(find.byIcon(Icons.open_in_new_rounded), findsOneWidget);
  });
}
