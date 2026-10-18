import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smartshala_mobile/core/data/messages_models.dart';
import 'package:smartshala_mobile/core/data/messages_repository.dart';
import 'package:smartshala_mobile/core/data/unread_controller.dart';
import 'package:smartshala_mobile/core/widgets/announcement_detail_screen.dart';
import 'package:smartshala_mobile/features/teacher/messages/teacher_messages_screen.dart';

Announcement _announcement({required String id, required bool isRead}) => Announcement(
      id: id,
      title: 'Notice $id',
      // Short enough that the old inline expand changed nothing on screen —
      // which is what made a tap look like it did nothing.
      body: 'Short.',
      audience: AnnouncementAudience.teachers,
      priority: AnnouncementPriority.normal,
      publishedAt: DateTime(2026, 10, 18, 9),
      isRead: isRead,
      postedByName: 'Principal',
    );

class _FakeMessages extends Fake implements MessagesRepository {
  _FakeMessages(this._page);

  final AnnouncementPage _page;
  final List<String> marked = [];

  @override
  Future<AnnouncementPage> announcements({int limit = 20, int offset = 0}) async => _page;

  @override
  Future<LeavePage> myLeave({LeaveStatus? status, int limit = 20, int offset = 0}) async =>
      LeavePage.empty;

  @override
  Future<void> markAnnouncementRead(String id) async => marked.add(id);
}

Future<UnreadController> _pump(WidgetTester tester, _FakeMessages repository) async {
  final unread = UnreadController();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<MessagesRepository>.value(value: repository),
        ChangeNotifierProvider<UnreadController>.value(value: unread),
      ],
      child: const MaterialApp(home: TeacherMessagesScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return unread;
}

void main() {
  testWidgets('opening an announcement shows it in full and drops the bell by one',
      (tester) async {
    final repository = _FakeMessages(
      AnnouncementPage(
        items: [
          _announcement(id: 'a1', isRead: false),
          _announcement(id: 'a2', isRead: false),
        ],
        total: 2,
        unreadCount: 2,
        hasMore: false,
      ),
    );

    final unread = await _pump(tester, repository);
    expect(unread.count, 2, reason: 'the list seeds the bell from the server count');

    await tester.tap(find.text('Notice a1'));
    await tester.pumpAndSettle();

    expect(find.byType(AnnouncementDetailScreen), findsOneWidget, reason: 'the tap opens it');
    expect(unread.count, 1, reason: 'the bell drops as soon as it is opened');
    expect(repository.marked, ['a1'], reason: 'the server is told, once');
  });

  testWidgets('re-opening an announcement already read leaves the bell alone', (tester) async {
    final repository = _FakeMessages(
      AnnouncementPage(
        items: [_announcement(id: 'a1', isRead: true)],
        total: 1,
        unreadCount: 0,
        hasMore: false,
      ),
    );

    final unread = await _pump(tester, repository);

    await tester.tap(find.text('Notice a1'));
    await tester.pumpAndSettle();

    expect(find.byType(AnnouncementDetailScreen), findsOneWidget);
    expect(unread.count, 0);
    expect(repository.marked, isEmpty);
  });

  test('the bell never goes below zero', () {
    final unread = UnreadController()..setCount(1);
    unread
      ..markOneRead()
      ..markOneRead();
    expect(unread.count, 0);

    unread.setCount(-5);
    expect(unread.count, 0);
  });
}
