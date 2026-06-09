export type FeatureKey = "welcome" | "attendance" | "marks" | "fees" | "communication";

export type TutorialFeature = {
  key: FeatureKey;
  title: string;
  /** One-line instruction shown under the title — what the user should do in the demo. */
  subtitle: string;
  accent: string;
  accentSoft: string;
};

export const FEATURES: TutorialFeature[] = [
  {
    key: "welcome",
    title: "Let's learn by doing",
    subtitle: "A quick, hands-on tour — try each everyday task yourself in a safe demo. Nothing here is saved.",
    accent: "#0071e3",
    accentSoft: "#EAF3FF"
  },
  {
    key: "attendance",
    title: "Mark attendance",
    subtitle: "Tap a student to switch them between Present and Absent, then press Save.",
    accent: "#34c759",
    accentSoft: "#EAF9EF"
  },
  {
    key: "marks",
    title: "Enter exam marks",
    subtitle: "Type in the missing student's marks, then Save — grades are calculated for you.",
    accent: "#5E5CE6",
    accentSoft: "#EEEEFD"
  },
  {
    key: "fees",
    title: "Collect a fee",
    subtitle: "Record this student's payment to clear their dues and generate a receipt.",
    accent: "#ff9500",
    accentSoft: "#FFF4E5"
  },
  {
    key: "communication",
    title: "Message parents",
    subtitle: "Pick a ready message template and send it to parents on WhatsApp.",
    accent: "#25D366",
    accentSoft: "#E9FBEF"
  }
];

export const WELCOME_CHECKLIST = [
  "Mark daily attendance",
  "Enter exam marks & get grades",
  "Collect fees & send receipts",
  "Message parents on WhatsApp"
];

export function WelcomeIllustration() {
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
