import type { ReactNode } from "react";
import type { Role } from "@/types";

export type FeatureKey = "welcome" | "attendance" | "marks" | "fees" | "communication";

export type TutorialFeature = {
  key: FeatureKey;
  title: string;
  intro: string;
  howto: string[];
  tip: string;
  accent: string;
  accentSoft: string;
  illustration: ReactNode;
  /** Live walkthrough anchor. Omitted for the intro step. */
  tour?: {
    selector: string;
    /** Route for this feature, or null when the role can't access it. */
    routeFor: (role: Role) => string | null;
  };
};

export type TourStep = {
  key: FeatureKey;
  title: string;
  howto: string[];
  accent: string;
  selector: string;
  route: string;
};

function isAdmin(role: Role) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

/* ── Step illustrations (looping, lightweight CSS animations) ── */

function WelcomeIllustration() {
  return (
    <div className="w-[230px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071e3]">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-24 rounded-full bg-[#1d1d1f]/75" />
          <div className="h-1.5 w-16 rounded-full bg-[#86868b]/50" />
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {["#0071e3", "#34c759", "#ff9500"].map((color, i) => (
          <div key={color} className="animate-tut-float rounded-lg bg-[#F4F7FC] p-2" style={{ animationDelay: `${i * 0.25}s` }}>
            <div className="h-3 w-3 rounded-full" style={{ background: color }} />
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#D7DEE8]" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-end gap-1.5 rounded-lg bg-[#F4F7FC] p-2.5">
        {[10, 18, 13, 22, 16].map((h, i) => (
          <div key={i} className="flex-1 origin-bottom animate-tut-bar rounded-sm bg-[#9CC2F5]" style={{ height: h, animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  );
}

function AttendanceIllustration() {
  const rows = ["#0071e3", "#5E5CE6", "#ff9500", "#34c759"];
  return (
    <div className="w-[235px] space-y-2.5 rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      {rows.map((color, i) => (
        <div key={color} className="flex items-center gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full" style={{ background: `${color}1f` }}>
            <div className="m-[7px] h-3.5 w-3.5 rounded-full" style={{ background: color }} />
          </div>
          <div className="h-2 flex-1 rounded-full bg-[#E7ECF2]" />
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34c759] animate-tut-pop" style={{ animationDelay: `${i * 0.45}s` }}>
            <CheckIcon />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarksIllustration() {
  return (
    <div className="w-[235px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex h-24 items-end gap-2">
        {[45, 72, 58, 88, 66].map((h, i) => (
          <div
            key={i}
            className="flex-1 origin-bottom animate-tut-bar rounded-t-md bg-gradient-to-t from-[#5E5CE6] to-[#9A98F2]"
            style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#F0F2F5] pt-3">
        <div className="space-y-1.5">
          <div className="h-2 w-16 rounded-full bg-[#E7ECF2]" />
          <div className="h-1.5 w-10 rounded-full bg-[#E7ECF2]" />
        </div>
        <span className="rounded-full bg-[#5E5CE6]/10 px-2.5 py-1 text-[13px] font-bold text-[#5E5CE6]">A+</span>
      </div>
    </div>
  );
}

function FeesIllustration() {
  return (
    <div className="w-[235px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-1.5 w-12 rounded-full bg-[#E7ECF2]" />
          <span className="text-[19px] font-bold tracking-tight text-[#1d1d1f]">₹12,500</span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]">
          <CheckIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff9500] to-[#ffbe55] animate-tut-fill" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-[#0F8A4A]">Paid in full</span>
        <span className="text-[#86868b]">Receipt sent</span>
      </div>
    </div>
  );
}

function CommunicationIllustration() {
  return (
    <div className="w-[235px] space-y-2.5 rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center gap-2.5 border-b border-[#F0F2F5] pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-24 rounded-full bg-[#1d1d1f]/70" />
          <div className="h-1.5 w-14 rounded-full bg-[#86868b]/40" />
        </div>
      </div>
      <div className="ml-auto w-[82%] animate-tut-rise rounded-2xl rounded-tr-md bg-[#DCF8C6] px-3 py-2.5">
        <div className="h-1.5 w-full rounded-full bg-[#5b8c52]/40" />
        <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-[#5b8c52]/40" />
        <div className="mt-1.5 flex justify-end">
          <svg className="h-3.5 w-4" fill="none" viewBox="0 0 24 24" stroke="#34B7F1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 13 4 4L15 7" />
            <path d="m11 15 2 2L22 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export const FEATURES: TutorialFeature[] = [
  {
    key: "welcome",
    title: "Let's learn the basics",
    intro: "A 1-minute walkthrough of how to run the everyday tasks. Step through each one, or jump straight into the live app for any feature.",
    howto: [
      "Mark daily attendance for your classes",
      "Set up exams and enter marks",
      "Collect fees and share receipts",
      "Message parents on WhatsApp"
    ],
    tip: "Reopen this tutorial anytime from “Tutorial” at the bottom of the sidebar.",
    accent: "#0071e3",
    accentSoft: "#EAF3FF",
    illustration: <WelcomeIllustration />
  },
  {
    key: "attendance",
    title: "Mark attendance",
    intro: "Record who's in class in under a minute.",
    howto: [
      "Open Attendance from the sidebar.",
      "Pick the class (and date) you want to mark.",
      "Tap each student to set Present, Late or Absent.",
      "Press Save — parents of absentees can be alerted automatically."
    ],
    tip: "Saved attendance flows straight into Reports and the dashboard.",
    accent: "#34c759",
    accentSoft: "#EAF9EF",
    illustration: <AttendanceIllustration />,
    tour: { selector: "[data-tour='attendance']", routeFor: () => "/attendance" }
  },
  {
    key: "marks",
    title: "Set exams & enter marks",
    intro: "Create an exam, type in scores, and grades are calculated for you.",
    howto: [
      "Go to Exams & Marks.",
      "Click Create Exam, then choose class, subject and max marks.",
      "Enter each student's marks in the grid.",
      "Save — totals, percentages and grades appear automatically in Reports."
    ],
    tip: "Re-open any exam later to edit marks; grades update instantly.",
    accent: "#5E5CE6",
    accentSoft: "#EEEEFD",
    illustration: <MarksIllustration />,
    tour: { selector: "[data-tour='exams']", routeFor: (role) => (isAdmin(role) ? "/exams" : "/teacher/marks") }
  },
  {
    key: "fees",
    title: "Collect fees & track dues",
    intro: "Take payments and keep every student's dues up to date.",
    howto: [
      "Open Fees.",
      "Click Record Payment and pick the student.",
      "Enter the amount and payment mode, then save.",
      "A receipt is generated to share on WhatsApp — pending dues update instantly."
    ],
    tip: "The Fees page lists defaulters at a glance so nothing slips through.",
    accent: "#ff9500",
    accentSoft: "#FFF4E5",
    illustration: <FeesIllustration />,
    tour: { selector: "[data-tour='fees']", routeFor: (role) => (isAdmin(role) ? "/fees" : null) }
  },
  {
    key: "communication",
    title: "Message parents",
    intro: "Send attendance alerts, fee reminders and announcements over WhatsApp.",
    howto: [
      "Open Communication.",
      "Choose a class, then a single student or the whole class.",
      "Pick a ready template or type your own message.",
      "Hit Send — it reaches parents on WhatsApp and is saved to your logs."
    ],
    tip: "You're all set! Explore the sidebar to dive into any feature.",
    accent: "#25D366",
    accentSoft: "#E9FBEF",
    illustration: <CommunicationIllustration />,
    tour: { selector: "[data-tour='communication']", routeFor: () => "/teacher/communication" }
  }
];

/** Build the live coach-mark steps for a role — one feature, or the full sequence. */
export function buildTourSteps(role: Role, onlyKey?: FeatureKey): TourStep[] {
  return FEATURES.filter((feature) => feature.tour && (!onlyKey || feature.key === onlyKey))
    .map((feature) => {
      const route = feature.tour!.routeFor(role);
      if (!route) return null;
      return { key: feature.key, title: feature.title, howto: feature.howto, accent: feature.accent, selector: feature.tour!.selector, route };
    })
    .filter((step): step is TourStep => step !== null);
}
