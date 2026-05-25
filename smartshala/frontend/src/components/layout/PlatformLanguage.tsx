"use client";

import { useEffect, useState } from "react";

export type PlatformLanguage = "en" | "hi";

const STORAGE_KEY = "smartshala.platformLanguage";
const CHANGE_EVENT = "smartshala:platform-language";

const dictionary: Record<string, string> = {
  "Dashboard": "डैशबोर्ड",
  "Students": "विद्यार्थी",
  "Teachers": "शिक्षक",
  "Classes": "कक्षाएं",
  "Attendance": "उपस्थिति",
  "Homework": "गृहकार्य",
  "Marks": "अंक",
  "Comms hub": "संचार केंद्र",
  "Reports": "रिपोर्ट",
  "Fees": "फीस",
  "Analytics": "विश्लेषण",
  "Message logs": "संदेश लॉग",
  "Settings": "सेटिंग्स",
  "Search students, reports, fees...": "विद्यार्थी, रिपोर्ट, फीस खोजें...",
  "Academic Year": "शैक्षणिक वर्ष",
  "Profile": "प्रोफाइल",
  "Switch Role": "भूमिका बदलें",
  "Logout": "लॉगआउट",
  "Mark today's attendance": "आज की उपस्थिति दर्ज करें",
  "Send fee reminder": "फीस रिमाइंडर भेजें",
  "Add student": "विद्यार्थी जोड़ें",
  "Record payment": "भुगतान दर्ज करें",
  "Marked today": "आज दर्ज",
  "Pending attendance": "लंबित उपस्थिति",
  "Defaulters": "बकायेदार",
  "Pending homework": "लंबित गृहकार्य",
  "Collected": "संग्रहित",
  "AI Alerts": "AI अलर्ट",
  "Attendance in marked classes": "दर्ज कक्षाओं में उपस्थिति",
  "Your class attendance": "आपकी कक्षा उपस्थिति",
  "All Classes": "सभी कक्षाएं",
  "Past Week Attendance": "पिछले सप्ताह की उपस्थिति",
  "Fee overview - active assignments": "फीस सारांश - सक्रिय असाइनमेंट",
  "Today's actions": "आज के कार्य",
  "School-wide": "पूरे स्कूल में",
  "Your students": "आपके विद्यार्थी",
  "Your classes today": "आज आपकी कक्षाएं",
  "Opens risk insights": "जोखिम संकेत खोलता है",
  "Needs action": "कार्रवाई चाहिए",
  "Recently happened": "हाल की गतिविधि",
  "View": "देखें",
  "Manage": "प्रबंधित करें",
  "Edit": "संपादित करें",
  "Save": "सहेजें",
  "Save changes": "बदलाव सहेजें",
  "Cancel": "रद्द करें",
  "Close": "बंद करें",
  "Create": "बनाएं",
  "Delete": "हटाएं",
  "Actions": "क्रियाएं",
  "Status": "स्थिति",
  "Active": "सक्रिय",
  "Inactive": "निष्क्रिय",
  "Pending": "लंबित",
  "Paid": "भुगतान हुआ",
  "Partial": "आंशिक",
  "Overdue": "अतिदेय",
  "Present": "उपस्थित",
  "Absent": "अनुपस्थित",
  "Late": "देर",
  "Half day": "आधा दिन",
  "Reliable attendance": "विश्वसनीय उपस्थिति",
  "Reset all present": "सभी को उपस्थित करें",
  "Save attendance": "उपस्थिति सहेजें",
  "Saving attendance...": "उपस्थिति सहेजी जा रही है...",
  "Attendance %": "उपस्थिति %",
  "Current rank": "वर्तमान रैंक",
  "Fee balance": "फीस बकाया",
  "Overall performance": "कुल प्रदर्शन",
  "Academic": "शैक्षणिक",
  "Academic: Good": "शैक्षणिक: अच्छा",
  "Academic: Excellent": "शैक्षणिक: उत्कृष्ट",
  "Academic: Needs Attention": "शैक्षणिक: ध्यान चाहिए",
  "Academic: At Risk": "शैक्षणिक: जोखिम में",
  "Attendance: Strong": "उपस्थिति: मजबूत",
  "Attendance: Watch": "उपस्थिति: निगरानी",
  "Attendance: Low": "उपस्थिति: कम",
  "Fees: Clear": "फीस: साफ",
  "Fees: Pending": "फीस: लंबित",
  "Call parent": "अभिभावक को कॉल करें",
  "WhatsApp": "व्हाट्सऐप",
  "Share": "साझा करें",
  "Print profile": "प्रोफाइल प्रिंट करें",
  "Fee ledger": "फीस लेजर",
  "Admission no": "प्रवेश संख्या",
  "Roll no": "रोल नंबर",
  "Parent": "अभिभावक",
  "Phone": "फोन",
  "Alternate phone": "वैकल्पिक फोन",
  "Action insight": "कार्रवाई संकेत",
  "Fees paid": "भुगतान की गई फीस",
  "Attendance records": "उपस्थिति रिकॉर्ड",
  "Exam analytics": "परीक्षा विश्लेषण",
  "Student": "विद्यार्थी",
  "Subject": "विषय",
  "Class Average": "कक्षा औसत",
  "Vs class": "कक्षा से तुलना",
  "Grade": "ग्रेड",
  "Rank": "रैंक",
  "No records found.": "कोई रिकॉर्ड नहीं मिला।",
  "Create new class": "नई कक्षा बनाएं",
  "Create Class": "कक्षा बनाएं",
  "Add new teacher": "नया शिक्षक जोड़ें",
  "Add Teacher": "शिक्षक जोड़ें",
  "Register new student": "नया विद्यार्थी पंजीकृत करें",
  "Register Student": "विद्यार्थी पंजीकृत करें",
  "Basic Details": "मूल विवरण",
  "Contact Details": "संपर्क विवरण",
  "Login Details": "लॉगिन विवरण",
  "Full Name": "पूरा नाम",
  "Email Address": "ईमेल पता",
  "Phone Number": "फोन नंबर",
  "Initial Password": "प्रारंभिक पासवर्ड",
  "Class Name": "कक्षा नाम",
  "Section": "सेक्शन",
  "Class Teacher": "कक्षा शिक्षक",
  "Subjects": "विषय",
  "Personal Details": "व्यक्तिगत विवरण",
  "Guardian Details": "अभिभावक विवरण",
  "Father": "पिता",
  "Mother": "माता",
  "Other guardian": "अन्य अभिभावक",
  "Name": "नाम",
  "Occupation": "व्यवसाय",
  "Address": "पता",
  "Date of Birth": "जन्म तिथि",
  "Gender": "लिंग",
  "Male": "पुरुष",
  "Female": "महिला",
  "Other": "अन्य",
  "Save profile": "प्रोफाइल सहेजें",
  "Teacher workspace": "शिक्षक कार्यक्षेत्र",
  "Parent communication": "अभिभावक संचार",
  "Send message": "संदेश भेजें",
  "Class": "कक्षा",
  "Teacher": "शिक्षक",
  "Total": "कुल",
  "Rate": "दर",
  "Send to": "किसे भेजें",
  "Individual student": "एक विद्यार्थी",
  "Entire class": "पूरी कक्षा",
  "No assigned classes": "कोई कक्षा असाइन नहीं",
  "No students": "कोई विद्यार्थी नहीं",
  "Message type": "संदेश प्रकार",
  "Language": "भाषा",
  "English": "अंग्रेज़ी",
  "Hindi": "हिंदी",
  "Teacher quick templates": "शिक्षक त्वरित टेम्पलेट",
  "Template library": "टेम्पलेट लाइब्रेरी",
  "Message": "संदेश",
  "Write the parent message": "अभिभावक संदेश लिखें",
  "Template preview": "टेम्पलेट पूर्वावलोकन",
  "Current parent:": "वर्तमान अभिभावक:",
  "Queueing...": "कतार में जोड़ा जा रहा है...",
  "Send to parent": "अभिभावक को भेजें",
  "Communication log": "संचार लॉग",
  "Latest parent messages appear first and feed the student profile log.": "नए अभिभावक संदेश पहले दिखते हैं और विद्यार्थी प्रोफाइल लॉग में जुड़ते हैं।",
  "All types": "सभी प्रकार",
  "All statuses": "सभी स्थितियां",
  "All status": "सभी स्थितियां",
  "Type": "प्रकार",
  "Recipient": "प्राप्तकर्ता",
  "Time": "समय",
  "Timestamp": "समय",
  "No messages": "कोई संदेश नहीं",
  "No parent messages sent yet.": "अभी तक कोई अभिभावक संदेश नहीं भेजा गया।",
  "View full": "पूरा देखें",
  "Previous": "पिछला",
  "Next": "अगला",
  "Attendance alert": "उपस्थिति अलर्ट",
  "Absence notification": "अनुपस्थिति सूचना",
  "Fee reminder": "फीस रिमाइंडर",
  "Exam announcement": "परीक्षा सूचना",
  "PTM invite": "पीटीएम निमंत्रण",
  "Holiday notice": "अवकाश सूचना",
  "Generic notice": "सामान्य सूचना",
  "Birthday wish": "जन्मदिन शुभकामना",
  "Homework reminder": "गृहकार्य रिमाइंडर",
  "Custom message": "कस्टम संदेश",
  "Low attendance warning": "कम उपस्थिति चेतावनी",
  "Same-day absence message": "उसी दिन अनुपस्थिति संदेश",
  "Pending fee follow-up": "लंबित फीस फॉलो-अप",
  "Upcoming assessment notice": "आगामी मूल्यांकन सूचना",
  "Parent-teacher meeting": "अभिभावक-शिक्षक बैठक",
  "School closure update": "स्कूल बंद सूचना",
  "General parent update": "सामान्य अभिभावक अपडेट",
  "Warm birthday message": "जन्मदिन शुभकामना संदेश",
  "Pending homework nudge": "लंबित गृहकार्य याद दिलाना",
  "Class cancelled": "कक्षा रद्द",
  "Sick child sent home": "बीमार विद्यार्थी घर भेजा गया",
  "Notifications": "सूचनाएं",
  "Parent notification logs": "अभिभावक सूचना लॉग",
  "Total sent today": "आज कुल भेजे गए",
  "Failed count": "विफल संख्या",
  "Credits remaining": "शेष क्रेडिट",
  "Retry": "फिर कोशिश करें",
  "Retrying...": "फिर कोशिश हो रही है...",
  "Not sent": "नहीं भेजा गया",
  "No notification logs found.": "कोई सूचना लॉग नहीं मिला।",
  "Queued": "कतार में",
  "Sent": "भेजा गया",
  "Delivered": "डिलीवर हुआ",
  "Read": "पढ़ा गया",
  "Failed": "विफल",
  "QUEUED": "कतार में",
  "SENT": "भेजा गया",
  "FAILED": "विफल",
  "COMPLETED": "पूरा",
  "MISSED": "छूटा",
  "NOTE": "नोट",
  "Attendance Alert": "उपस्थिति अलर्ट",
  "Absence Notification": "अनुपस्थिति सूचना",
  "Fee Reminder": "फीस रिमाइंडर",
  "Exam Announcement": "परीक्षा सूचना",
  "Ptm Invite": "पीटीएम निमंत्रण",
  "Holiday Notice": "अवकाश सूचना",
  "Generic Notice": "सामान्य सूचना",
  "Birthday Wish": "जन्मदिन शुभकामना",
  "Homework Reminder": "गृहकार्य रिमाइंडर",
  "Printable and exportable reports": "प्रिंट और एक्सपोर्ट योग्य रिपोर्ट",
  "Daily attendance report": "दैनिक उपस्थिति रिपोर्ट",
  "Printable attendance scope, pending classes, marked-only averages, and CSV export.": "प्रिंट योग्य उपस्थिति दायरा, लंबित कक्षाएं, केवल दर्ज औसत, और CSV एक्सपोर्ट।",
  "Open report": "रिपोर्ट खोलें",
  "Fee defaulter report": "फीस बकायेदार रिपोर्ट",
  "Exportable follow-up queue with aging and WhatsApp reminders.": "एजिंग और व्हाट्सऐप रिमाइंडर वाली एक्सपोर्ट योग्य फॉलो-अप कतार।",
  "Open queue": "कतार खोलें",
  "WhatsApp delivery log": "व्हाट्सऐप डिलीवरी लॉग",
  "Auditable parent-message history for receipts, alerts, and notices.": "रसीद, अलर्ट और सूचना के लिए जांच योग्य अभिभावक-संदेश इतिहास।",
  "Open logs": "लॉग खोलें",
  "Nudge teachers": "शिक्षकों को याद दिलाएं",
  "Export CSV": "CSV एक्सपोर्ट करें",
  "Today": "आज",
  "Yesterday": "कल",
  "This week": "इस सप्ताह",
  "This month": "इस महीने",
  "Custom": "कस्टम",
  "Total classes": "कुल कक्षाएं",
  "Marked": "दर्ज",
  "Avg. attendance (marked)": "औसत उपस्थिति (दर्ज)",
  "Class-wise trend": "कक्षा अनुसार रुझान",
  "No classes available.": "कोई कक्षा उपलब्ध नहीं।",
  "AI analytics": "AI विश्लेषण",
  "Attendance and fee risk insights": "उपस्थिति और फीस जोखिम संकेत",
  "Collection command center": "कलेक्शन कमांड सेंटर",
  "Classes and assignments": "कक्षाएं और असाइनमेंट",
  "Teacher management": "शिक्षक प्रबंधन",
  "My classes": "मेरी कक्षाएं",
  "Edit student details": "विद्यार्थी विवरण संपादित करें",
  "Edit teacher details": "शिक्षक विवरण संपादित करें",
  "School and notification settings": "स्कूल और सूचना सेटिंग्स"
};

const dayMap: Record<string, string> = {
  Sun: "रवि",
  Mon: "सोम",
  Tue: "मंगल",
  Wed: "बुध",
  Thu: "गुरु",
  Fri: "शुक्र",
  Sat: "शनि"
};

const monthMap: Record<string, string> = {
  Jan: "जन",
  Feb: "फर",
  Mar: "मार्च",
  Apr: "अप्रै",
  May: "मई",
  Jun: "जून",
  Jul: "जुल",
  Aug: "अग",
  Sep: "सित",
  Oct: "अक्टू",
  Nov: "नव",
  Dec: "दिस"
};

function getInitialLanguage(): PlatformLanguage {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "hi" ? "hi" : "en";
}

function translateDynamic(input: string) {
  let output = input;
  output = output.replace(/^Academic Year\s+(.+)$/, "शैक्षणिक वर्ष $1");
  output = output.replace(/^Class\s+(.+)\s+\((\d+)\s+students?\)$/, "कक्षा $1 ($2 विद्यार्थी)");
  output = output.replace(/^Class\s+(.+)$/, "कक्षा $1");
  output = output.replace(/^Roll\s+(.+)$/, "रोल $1");
  output = output.replace(/^Page\s+(\d+)\s+of\s+(\d+)$/, "पृष्ठ $1 / $2");
  output = output.replace(/^(\d+)\s+logs?$/, "$1 लॉग");
  output = output.replace(/^(\d+)\s+parent contacts? selected\.$/, "$1 अभिभावक संपर्क चयनित।");
  output = output.replace(/^Current parent:\s+(.+)$/, "वर्तमान अभिभावक: $1");
  output = output.replace(/^Message queued for\s+(\d+)\s+parents?\.$/, "$1 अभिभावक के लिए संदेश कतार में जोड़ा गया।");
  output = output.replace(/^Nudged\s+(\d+)\s+of\s+(\d+)\s+pending class teachers\.$/, "$1 में से $2 लंबित कक्षा शिक्षकों को याद दिलाया।");
  output = output.replace(/(\d+) of (\d+) classes marked/g, "$1 में से $2 कक्षाएं दर्ज");
  output = output.replace(/(\d+) students?/g, "$1 विद्यार्थी");
  output = output.replace(/(\d+) exams?/g, "$1 परीक्षाएं");
  output = output.replace(/(\d+) marks?/g, "$1 अंक");
  output = output.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, (match) => dayMap[match] ?? match);
  output = output.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (match) => monthMap[match] ?? match);
  return output;
}

function translate(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return input;
  const translated = dictionary[trimmed] ?? translateDynamic(trimmed);
  return input.replace(trimmed, translated);
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("script,style,textarea,code,kbd,samp,[data-no-translate]"));
}

const originalText = new WeakMap<Text, string>();

function applyLanguage(language: PlatformLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dataset.platformLanguage = language;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((node) => {
    if (shouldSkipNode(node)) return;
    const current = node.nodeValue ?? "";
    const storedOriginal = originalText.get(node);
    let original = storedOriginal ?? current;

    if (language === "en") {
      if (storedOriginal) {
        const translatedOriginal = translate(storedOriginal);
        if (current === translatedOriginal && current !== storedOriginal) {
          node.nodeValue = storedOriginal;
          return;
        }
      }
      originalText.set(node, current);
      return;
    }

    if (storedOriginal) {
      const translatedOriginal = translate(storedOriginal);
      if (current !== storedOriginal && current !== translatedOriginal) {
        original = current;
      }
    }

    originalText.set(node, original);
    const next = translate(original);
    if (node.nodeValue !== next) node.nodeValue = next;
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]").forEach((element) => {
    const current = element.getAttribute("placeholder") ?? "";
    const storedOriginal = element.dataset.originalPlaceholder;
    let original = storedOriginal ?? current;

    if (language === "en") {
      if (storedOriginal) {
        const translatedOriginal = translate(storedOriginal);
        if (current === translatedOriginal && current !== storedOriginal) {
          element.setAttribute("placeholder", storedOriginal);
          return;
        }
      }
      element.dataset.originalPlaceholder = current;
      return;
    }

    if (storedOriginal) {
      const translatedOriginal = translate(storedOriginal);
      if (current !== storedOriginal && current !== translatedOriginal) {
        original = current;
      }
    }

    element.dataset.originalPlaceholder = original;
    element.setAttribute("placeholder", translate(original));
  });
}

export function setPlatformLanguage(language: PlatformLanguage) {
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent<PlatformLanguage>(CHANGE_EVENT, { detail: language }));
}

export function LanguageToggle() {
  const [language, setLanguage] = useState<PlatformLanguage>("en");

  useEffect(() => {
    setLanguage(getInitialLanguage());
    const onChange = (event: Event) => {
      setLanguage((event as CustomEvent<PlatformLanguage>).detail ?? getInitialLanguage());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return (
    <div className="hidden rounded-full border border-[#DCE1E8] bg-[#f5f5f7] p-0.5 text-[11px] font-bold sm:inline-flex" aria-label="Language">
      {(["en", "hi"] as const).map((option) => (
        <button
          className={`rounded-full px-2.5 py-1 transition-colors ${language === option ? "bg-[#2456E6] text-white shadow-sm" : "text-[#5A6573] hover:text-[#1d1d1f]"}`}
          key={option}
          onClick={() => setPlatformLanguage(option)}
          type="button"
        >
          {option === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}

export function PlatformTranslator() {
  useEffect(() => {
    let language = getInitialLanguage();
    let frame = 0;

    function scheduleApply(nextLanguage = language) {
      language = nextLanguage;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applyLanguage(language));
    }

    scheduleApply(language);
    const observer = new MutationObserver(() => scheduleApply(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });

    const onChange = (event: Event) => scheduleApply((event as CustomEvent<PlatformLanguage>).detail ?? getInitialLanguage());
    window.addEventListener(CHANGE_EVENT, onChange);

    return () => {
      observer.disconnect();
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
