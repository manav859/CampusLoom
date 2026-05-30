"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { apiFetch, MarksContext, MarksExam } from "@/lib/api";
import { downloadCsv, exportPdfReport, percent, ReportExportActions, ReportTable } from "@/features/reports/reportUtils";
import { StatusPill } from "@/components/ui/StatusPill";

type ExamReportRow = {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  examName: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number;
  percentage: number | null;
  grade: string;
};

export default function ExamReportsPage() {
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  
  const [context, setContext] = useState<MarksContext | null>(null);
  const [allExams, setAllExams] = useState<MarksExam[]>([]);
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  
  const [rows, setRows] = useState<ExamReportRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [ctxData, examsData] = await Promise.all([
          apiFetch<MarksContext>("/marks/context"),
          apiFetch<MarksExam[]>("/marks/exams?limit=100") // Adjust if exams api is paginated
        ]);
        // Note: the /marks/exams API might return { items: [] } depending on its implementation.
        // We'll safely parse it.
        const examsList = Array.isArray(examsData) ? examsData : (examsData as any).items || [];
        setContext(ctxData);
        setAllExams(examsList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load context");
      } finally {
        setLoadingContext(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    // Debounce or just load on filter change
    const delay = setTimeout(async () => {
      setLoadingData(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedClasses.length) params.set("classIds", selectedClasses.join(","));
        if (selectedExams.length) params.set("examIds", selectedExams.join(","));
        if (selectedSubjects.length) params.set("subjectIds", selectedSubjects.join(","));
        
        const data = await apiFetch<ExamReportRow[]>(`/reports/exams?${params.toString()}`);
        setRows(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report data");
      } finally {
        setLoadingData(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [selectedClasses, selectedExams, selectedSubjects]);

  const classOptions = useMemo(() => {
    return (context?.classes || []).map((c) => ({
      label: `${c.name}-${c.section}`,
      value: c.id
    }));
  }, [context]);

  const subjectOptions = useMemo(() => {
    // If classes are selected, only show subjects from those classes
    const availableClasses = selectedClasses.length > 0 
      ? (context?.classes || []).filter(c => selectedClasses.includes(c.id))
      : (context?.classes || []);
      
    const subjectMap = new Map<string, string>();
    availableClasses.forEach(c => {
      c.subjects?.forEach(s => subjectMap.set(s.id, s.name));
    });
    return Array.from(subjectMap.entries()).map(([value, label]) => ({ label, value }));
  }, [context, selectedClasses]);

  const examOptions = useMemo(() => {
    const available = selectedClasses.length > 0
      ? allExams.filter(e => !e.classId || selectedClasses.includes(e.classId))
      : allExams;
    
    // Group exams by name to avoid duplicates if same exam name appears across subjects
    const uniqueExams = new Map<string, string>();
    available.forEach(e => {
      uniqueExams.set(e.id, `${e.name} (${e.term.replace("_", " ")}) - ${e.className}`);
    });
    return Array.from(uniqueExams.entries()).map(([value, label]) => ({ label, value }));
  }, [allExams, selectedClasses]);

  function reportRows() {
    return [
      ["Student", "Admission no", "Class", "Exam", "Subject", "Max Marks", "Marks", "Percentage", "Grade"],
      ...rows.map((row) => [
        row.studentName,
        row.admissionNumber,
        row.className,
        row.examName,
        row.subjectName,
        String(row.maxMarks),
        String(row.marksObtained),
        row.percentage ? percent(row.percentage) : "-",
        row.grade
      ])
    ];
  }

  function exportCsv() {
    downloadCsv(`exam-report-${new Date().toISOString().slice(0, 10)}.csv`, reportRows());
  }

  function exportPdf() {
    exportPdfReport({
      filename: `exam-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows: reportRows(),
      title: "Exam Results Report"
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Exam reports"
        action={<ReportExportActions disabled={loadingData || rows.length === 0} onExportCsv={exportCsv} onExportPdf={exportPdf} />}
      />

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]">
        <MultiSelect 
          label="Select Classes"
          options={classOptions}
          values={selectedClasses}
          onChange={setSelectedClasses}
          className="min-w-[180px]"
        />
        <MultiSelect 
          label="Select Subjects"
          options={subjectOptions}
          values={selectedSubjects}
          onChange={setSelectedSubjects}
          className="min-w-[180px]"
        />
        <MultiSelect 
          label="Select Exams"
          options={examOptions}
          values={selectedExams}
          onChange={setSelectedExams}
          className="min-w-[280px]"
        />
      </div>

      <div className="hidden md:block">
        <ReportTable colSpan={9} empty={loadingData || loadingContext ? "Loading data..." : "No results found for selected criteria."} isEmpty={loadingData || loadingContext || rows.length === 0} minWidth="min-w-[1000px]">
          {!loadingData && rows.length > 0 ? (
            <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-5 py-3.5 font-semibold">Class</th>
                <th className="px-5 py-3.5 font-semibold">Exam</th>
                <th className="px-5 py-3.5 font-semibold">Subject</th>
                <th className="px-5 py-3.5 font-semibold text-right">Max Marks</th>
                <th className="px-5 py-3.5 font-semibold text-right">Marks</th>
                <th className="px-5 py-3.5 font-semibold text-right">Percent</th>
                <th className="px-5 py-3.5 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {rows.map((row) => (
                <tr className="table-row hover:bg-[#F7F8FB] transition-colors" key={row.id}>
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.studentName}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.admissionNumber}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.className}</td>
                  <td className="px-5 py-4 font-medium text-[#1d1d1f]">{row.examName}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.subjectName}</td>
                  <td className="px-5 py-4 text-right text-[#5A6573]">{row.maxMarks}</td>
                  <td className="px-5 py-4 text-right font-semibold text-[#1d1d1f]">{row.marksObtained}</td>
                  <td className="px-5 py-4 text-right text-[#5A6573]">{row.percentage ? percent(row.percentage) : "-"}</td>
                  <td className="px-5 py-4">
                    <StatusPill 
                      label={row.grade} 
                      tone={
                        ["A", "A1", "A2", "B1", "B2"].includes(row.grade) ? "good" :
                        ["C1", "C2", "D"].includes(row.grade) ? "warn" : "danger"
                      } 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </>
          ) : null}
        </ReportTable>
      </div>
      
      <div className="space-y-3 md:hidden">
        {loadingData || loadingContext ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">Loading data...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">No results found.</div>
        ) : (
          rows.map((row) => (
            <article className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]" key={row.id}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[#1d1d1f]">{row.studentName}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{row.admissionNumber} · {row.className}</p>
                </div>
                <StatusPill 
                  label={row.grade} 
                  tone={
                    ["A", "A1", "A2", "B1", "B2"].includes(row.grade) ? "good" :
                    ["C1", "C2", "D"].includes(row.grade) ? "warn" : "danger"
                  } 
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-[12px] font-semibold text-[#86868b]">Exam & Subject</p>
                  <p className="mt-1 font-semibold text-[#1d1d1f]">{row.examName}</p>
                  <p className="text-[#5A6573]">{row.subjectName}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#86868b]">Score</p>
                  <p className="mt-1 font-semibold text-[#1d1d1f]">{row.marksObtained} / {row.maxMarks}</p>
                  <p className="text-[#5A6573]">{row.percentage ? percent(row.percentage) : "-"}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
