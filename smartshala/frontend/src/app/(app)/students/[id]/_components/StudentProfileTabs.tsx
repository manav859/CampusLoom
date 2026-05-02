"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { StudentDetail } from "@/lib/api";
import type { AcademicTabPanelProps } from "./AcademicTabPanel";
import type { AttendanceTabPanelProps } from "./AttendanceTabPanel";
import type { BehaviourTabPanelProps } from "./BehaviourTabPanel";
import type { CommunicationTabPanelProps } from "./CommunicationTabPanel";
import type { DocumentsTabPanelProps } from "./DocumentsTabPanel";
import type { FeesTabPanelProps } from "./FeesTabPanel";
import type { HomeworkTabPanelProps } from "./HomeworkTabPanel";
import type { AttendanceSummary } from "./studentProfileUtils";

type TabKey = "academic" | "homework" | "attendance" | "fees" | "communication" | "behaviour" | "documents";

type TabConfig = {
  key: TabKey;
  label: string;
  emptyMessage?: string;
};

type StudentProfileTabsProps = {
  student: StudentDetail;
  attendance: AttendanceSummary;
  pendingFees: number;
  paidFees: number;
};

const tabs: TabConfig[] = [
  { key: "academic", label: "Academic" },
  { key: "homework", label: "Homework", emptyMessage: "No homework records available yet." },
  { key: "attendance", label: "Attendance", emptyMessage: "No dedicated attendance dashboard available yet." },
  { key: "fees", label: "Fees" },
  { key: "communication", label: "Communication", emptyMessage: "No communication history available yet." },
  { key: "behaviour", label: "Behaviour", emptyMessage: "No behaviour notes available yet." },
  { key: "documents", label: "Documents", emptyMessage: "No student documents available yet." }
];

const AcademicPanel = dynamic<AcademicTabPanelProps>(() => import("./AcademicTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const FeesPanel = dynamic<FeesTabPanelProps>(() => import("./FeesTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const HomeworkPanel = dynamic<HomeworkTabPanelProps>(() => import("./HomeworkTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const AttendancePanel = dynamic<AttendanceTabPanelProps>(() => import("./AttendanceTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const CommunicationPanel = dynamic<CommunicationTabPanelProps>(() => import("./CommunicationTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const BehaviourPanel = dynamic<BehaviourTabPanelProps>(() => import("./BehaviourTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const DocumentsPanel = dynamic<DocumentsTabPanelProps>(() => import("./DocumentsTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

const EmptyPanel = dynamic(() => import("./EmptyTabPanel"), {
  loading: () => <TabPanelSkeleton />,
  ssr: false
});

function TabPanelSkeleton() {
  return (
    <section className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-6 shadow-apple-sm">
      <Skeleton className="h-5 w-36 rounded-md" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </section>
  );
}

export function StudentProfileTabs({ student, attendance, pendingFees, paidFees }: StudentProfileTabsProps) {
  const availableTabs = useMemo(() => {
    const allowed = new Set<TabKey>((student.access?.allowedTabs as TabKey[] | undefined) ?? tabs.map((tab) => tab.key));
    return tabs.filter((tab) => allowed.has(tab.key));
  }, [student.access?.allowedTabs]);
  const [activeTab, setActiveTab] = useState<TabKey>(availableTabs[0]?.key ?? "academic");
  const activeConfig = availableTabs.find((tab) => tab.key === activeTab) ?? availableTabs[0] ?? tabs[0];
  const panelId = `student-tab-panel-${activeConfig.key}`;

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(availableTabs[0]?.key ?? "academic");
    }
  }, [activeTab, availableTabs]);

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-1.5 shadow-apple-sm">
        <div className="flex gap-1" role="tablist" aria-label="Student profile sections">
          {availableTabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                aria-controls={`student-tab-panel-${tab.key}`}
                aria-selected={selected}
                className={`flex-1 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                  selected
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "text-[#6e6e73] hover:bg-[rgba(0,0,0,0.04)] hover:text-[#1d1d1f]"
                }`}
                id={`student-tab-${tab.key}`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div aria-labelledby={`student-tab-${activeConfig.key}`} id={panelId} role="tabpanel">
        {availableTabs.length === 0 ? (
          <EmptyPanel title="Restricted" message="No student sections are available for this role." />
        ) : activeTab === "academic" ? (
          <AcademicPanel student={student} attendance={attendance} pendingFees={pendingFees} paidFees={paidFees} />
        ) : activeTab === "homework" ? (
          <HomeworkPanel student={student} />
        ) : activeTab === "attendance" ? (
          <AttendancePanel student={student} />
        ) : activeTab === "fees" ? (
          <FeesPanel student={student} />
        ) : activeTab === "communication" ? (
          <CommunicationPanel student={student} />
        ) : activeTab === "behaviour" ? (
          <BehaviourPanel student={student} />
        ) : activeTab === "documents" ? (
          <DocumentsPanel student={student} />
        ) : (
          <EmptyPanel title={activeConfig.label} message={activeConfig.emptyMessage ?? "No records available yet."} />
        )}
      </div>
    </section>
  );
}
