import type { CommunicationMessageType } from "./api";

export type TemplateLanguage = "en" | "hi";

export type CommunicationTemplate = {
  type: Exclude<CommunicationMessageType, "CUSTOM">;
  label: string;
  description: string;
  variants: Record<TemplateLanguage, string>;
};

export type TemplateVariables = {
  studentName?: string;
  className?: string;
  schoolName?: string;
  date?: string;
  amount?: string;
  dueDate?: string;
  examName?: string;
  ptmTime?: string;
  holidayReason?: string;
  teacherName?: string;
};

export const communicationTemplates: CommunicationTemplate[] = [
  {
    type: "ATTENDANCE_ALERT",
    label: "Attendance alert",
    description: "Low attendance warning",
    variants: {
      en: "Dear parent, {studentName}'s attendance in Class {className} needs attention. Please connect with the class teacher.",
      hi: "प्रिय अभिभावक, कक्षा {className} में {studentName} की उपस्थिति पर ध्यान देने की आवश्यकता है। कृपया कक्षा शिक्षक से संपर्क करें।"
    }
  },
  {
    type: "ABSENCE_NOTIFICATION",
    label: "Absence notification",
    description: "Same-day absence message",
    variants: {
      en: "Dear parent, {studentName} was absent from Class {className} on {date}. Please share the reason with the school.",
      hi: "प्रिय अभिभावक, {date} को {studentName} कक्षा {className} में अनुपस्थित था/थी। कृपया अनुपस्थिति का कारण स्कूल को बताएं।"
    }
  },
  {
    type: "FEE_REMINDER",
    label: "Fee reminder",
    description: "Pending fee follow-up",
    variants: {
      en: "Dear parent, fee amount {amount} for {studentName} is due by {dueDate}. Kindly complete the payment.",
      hi: "प्रिय अभिभावक, {studentName} की फीस {amount} {dueDate} तक देय है। कृपया भुगतान पूरा करें।"
    }
  },
  {
    type: "EXAM_ANNOUNCEMENT",
    label: "Exam announcement",
    description: "Upcoming assessment notice",
    variants: {
      en: "Dear parent, {examName} for Class {className} is scheduled on {date}. Please help {studentName} prepare.",
      hi: "प्रिय अभिभावक, कक्षा {className} के लिए {examName} {date} को निर्धारित है। कृपया {studentName} की तैयारी में सहयोग करें।"
    }
  },
  {
    type: "PTM_INVITE",
    label: "PTM invite",
    description: "Parent-teacher meeting",
    variants: {
      en: "Dear parent, PTM for Class {className} is scheduled on {date} at {ptmTime}. We request your presence.",
      hi: "प्रिय अभिभावक, कक्षा {className} की पीटीएम {date} को {ptmTime} बजे निर्धारित है। आपकी उपस्थिति अपेक्षित है।"
    }
  },
  {
    type: "HOLIDAY_NOTICE",
    label: "Holiday notice",
    description: "School closure update",
    variants: {
      en: "Dear parent, school will remain closed on {date} due to {holidayReason}. Classes resume on the next working day.",
      hi: "प्रिय अभिभावक, {holidayReason} के कारण {date} को स्कूल बंद रहेगा। कक्षाएं अगले कार्य दिवस पर फिर से शुरू होंगी।"
    }
  },
  {
    type: "GENERIC_NOTICE",
    label: "Generic notice",
    description: "General parent update",
    variants: {
      en: "Dear parent, this is an update from {schoolName} for Class {className}. Please note: {holidayReason}.",
      hi: "प्रिय अभिभावक, {schoolName} की ओर से कक्षा {className} के लिए सूचना: {holidayReason}।"
    }
  },
  {
    type: "BIRTHDAY_WISH",
    label: "Birthday wish",
    description: "Warm birthday message",
    variants: {
      en: "Dear {studentName}, wishing you a very happy birthday from {schoolName}. Have a wonderful year ahead.",
      hi: "प्रिय {studentName}, {schoolName} की ओर से जन्मदिन की हार्दिक शुभकामनाएं। आपका वर्ष मंगलमय हो।"
    }
  },
  {
    type: "HOMEWORK_REMINDER",
    label: "Homework reminder",
    description: "Pending homework nudge",
    variants: {
      en: "Dear parent, please help {studentName} complete the assigned homework for Class {className} by {dueDate}.",
      hi: "प्रिय अभिभावक, कृपया {studentName} को कक्षा {className} का होमवर्क {dueDate} तक पूरा करने में सहायता करें।"
    }
  }
];

export function templateLabel(type: CommunicationMessageType) {
  if (type === "CUSTOM") return "Custom message";
  return communicationTemplates.find((template) => template.type === type)?.label ?? "Message";
}

export function renderCommunicationTemplate(template: string, variables: TemplateVariables) {
  return template.replace(/\{(\w+)\}/g, (_match, key: keyof TemplateVariables) => variables[key] ?? `{${key}}`);
}

export function templateForType(type: CommunicationMessageType) {
  return communicationTemplates.find((template) => template.type === type) ?? null;
}
