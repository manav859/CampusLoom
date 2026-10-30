import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// A parent-message template with its English and Hindi text. These mirror the
/// web Settings "Message Templates" defaults. Edits are kept on the device
/// (like the web's per-browser store) — nothing is sent to the server.
class CommunicationTemplate {
  const CommunicationTemplate({
    required this.type,
    required this.label,
    required this.description,
    required this.en,
    required this.hi,
  });

  final String type;
  final String label;
  final String description;
  final String en;
  final String hi;
}

typedef TemplateDraft = ({String en, String hi});

const communicationTemplates = <CommunicationTemplate>[
  CommunicationTemplate(
    type: 'ATTENDANCE_ALERT',
    label: 'Attendance alert',
    description: 'Low attendance warning',
    en: "Dear parent, {studentName}'s attendance in Class {className} needs attention. Please connect with the class teacher.",
    hi: 'प्रिय अभिभावक, कक्षा {className} में {studentName} की उपस्थिति पर ध्यान देने की आवश्यकता है। कृपया कक्षा शिक्षक से संपर्क करें।',
  ),
  CommunicationTemplate(
    type: 'ABSENCE_NOTIFICATION',
    label: 'Absence notification',
    description: 'Same-day absence message',
    en: 'Dear parent, {studentName} was absent from Class {className} on {date}. Please share the reason with the school.',
    hi: 'प्रिय अभिभावक, {date} को {studentName} कक्षा {className} में अनुपस्थित था/थी। कृपया अनुपस्थिति का कारण स्कूल को बताएं।',
  ),
  CommunicationTemplate(
    type: 'FEE_REMINDER',
    label: 'Fee reminder',
    description: 'Pending fee follow-up',
    en: 'Dear parent, fee amount {amount} for {studentName} is due by {dueDate}. Kindly complete the payment.',
    hi: 'प्रिय अभिभावक, {studentName} की फीस {amount} {dueDate} तक देय है। कृपया भुगतान पूरा करें।',
  ),
  CommunicationTemplate(
    type: 'EXAM_ANNOUNCEMENT',
    label: 'Exam announcement',
    description: 'Upcoming assessment notice',
    en: 'Dear parent, {examName} for Class {className} is scheduled on {date}. Please help {studentName} prepare.',
    hi: 'प्रिय अभिभावक, कक्षा {className} के लिए {examName} {date} को निर्धारित है। कृपया {studentName} की तैयारी में सहयोग करें।',
  ),
  CommunicationTemplate(
    type: 'PTM_INVITE',
    label: 'PTM invite',
    description: 'Parent-teacher meeting',
    en: 'Dear parent, PTM for Class {className} is scheduled on {date} at {ptmTime}. We request your presence.',
    hi: 'प्रिय अभिभावक, कक्षा {className} की पीटीएम {date} को {ptmTime} बजे निर्धारित है। आपकी उपस्थिति अपेक्षित है।',
  ),
  CommunicationTemplate(
    type: 'HOLIDAY_NOTICE',
    label: 'Holiday notice',
    description: 'School closure update',
    en: 'Dear parent, school will remain closed on {date} due to {holidayReason}. Classes resume on the next working day.',
    hi: 'प्रिय अभिभावक, {holidayReason} के कारण {date} को स्कूल बंद रहेगा। कक्षाएं अगले कार्य दिवस पर फिर से शुरू होंगी।',
  ),
  CommunicationTemplate(
    type: 'GENERIC_NOTICE',
    label: 'Generic notice',
    description: 'General parent update',
    en: 'Dear parent, this is an update from {schoolName} for Class {className}. Please note: {holidayReason}.',
    hi: 'प्रिय अभिभावक, {schoolName} की ओर से कक्षा {className} के लिए सूचना: {holidayReason}।',
  ),
  CommunicationTemplate(
    type: 'BIRTHDAY_WISH',
    label: 'Birthday wish',
    description: 'Warm birthday message',
    en: 'Dear {studentName}, wishing you a very happy birthday from {schoolName}. Have a wonderful year ahead.',
    hi: 'प्रिय {studentName}, {schoolName} की ओर से जन्मदिन की हार्दिक शुभकामनाएं। आपका वर्ष मंगलमय हो।',
  ),
  CommunicationTemplate(
    type: 'HOMEWORK_REMINDER',
    label: 'Homework reminder',
    description: 'Pending homework nudge',
    en: 'Dear parent, please help {studentName} complete the assigned homework for Class {className} by {dueDate}.',
    hi: 'प्रिय अभिभावक, कृपया {studentName} को कक्षा {className} का होमवर्क {dueDate} तक पूरा करने में सहायता करें।',
  ),
];

/// Device-local store for edited templates, written as JSON to the app's
/// documents directory. Loading merges saved edits over the defaults.
class CommunicationTemplateStore {
  static const _fileName = 'communication_templates.json';

  Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  Future<Map<String, TemplateDraft>> load() async {
    final result = <String, TemplateDraft>{
      for (final template in communicationTemplates) template.type: (en: template.en, hi: template.hi),
    };
    try {
      final file = await _file();
      if (await file.exists()) {
        final saved = (json.decode(await file.readAsString()) as Map).cast<String, dynamic>();
        for (final entry in saved.entries) {
          final base = result[entry.key];
          if (base == null) continue;
          final value = (entry.value as Map).cast<String, dynamic>();
          result[entry.key] = (en: value['en'] as String? ?? base.en, hi: value['hi'] as String? ?? base.hi);
        }
      }
    } catch (_) {
      // A corrupt or unreadable file just means "use the defaults".
    }
    return result;
  }

  Future<void> save(Map<String, TemplateDraft> drafts) async {
    final file = await _file();
    await file.writeAsString(
      json.encode({for (final entry in drafts.entries) entry.key: {'en': entry.value.en, 'hi': entry.value.hi}}),
    );
  }

  Future<void> reset() async {
    final file = await _file();
    if (await file.exists()) await file.delete();
  }
}
