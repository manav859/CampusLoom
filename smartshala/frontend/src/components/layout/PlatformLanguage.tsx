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
  "Save profile": "प्रोफाइल सहेजें"
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
    const original = originalText.get(node) ?? node.nodeValue ?? "";
    if (!originalText.has(node)) originalText.set(node, original);
    const next = language === "hi" ? translate(original) : original;
    if (node.nodeValue !== next) node.nodeValue = next;
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]").forEach((element) => {
    const original = element.dataset.originalPlaceholder ?? element.getAttribute("placeholder") ?? "";
    element.dataset.originalPlaceholder = original;
    element.setAttribute("placeholder", language === "hi" ? translate(original) : original);
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
