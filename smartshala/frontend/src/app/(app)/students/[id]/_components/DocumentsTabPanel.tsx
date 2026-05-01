"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { studentsApi, type StudentDetail, type StudentDocumentUploadPayload } from "@/lib/api";

export type DocumentsTabPanelProps = {
  student: StudentDetail;
};

type StudentDocument = StudentDetail["documents"][number];
type DocumentType = StudentDocument["type"];

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "CERTIFICATE", label: "Certificates" },
  { value: "MEDICAL", label: "Medical" },
  { value: "PARENT_ID", label: "Parent ID" },
  { value: "AGREEMENT", label: "Agreements" }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(type: DocumentType) {
  return documentTypes.find((item) => item.value === type)?.label ?? type;
}

function typeTone(type: DocumentType) {
  if (type === "CERTIFICATE") return "good";
  if (type === "MEDICAL") return "warn";
  return "neutral";
}

export default function DocumentsTabPanel({ student }: DocumentsTabPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>(student.documents ?? []);
  const [type, setType] = useState<DocumentType>("CERTIFICATE");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ tone: "good" | "warn" | "danger"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      documentTypes.map((item) => ({
        ...item,
        count: documents.filter((document) => document.type === item.value).length
      })),
    [documents]
  );

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setStatus({ tone: "danger", message: "Select a file before uploading." });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      const payload: StudentDocumentUploadPayload = {
        type,
        name: name.trim() || undefined,
        file
      };
      const uploaded = await studentsApi.uploadDocument(student.id, payload);
      setDocuments((current) => [uploaded, ...current]);
      setName("");
      setFile(null);
      event.currentTarget.reset();
      setStatus({ tone: "good", message: "Document uploaded." });
    } catch (error) {
      setStatus({ tone: "danger", message: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(document: StudentDocument) {
    setDownloadingId(document.id);
    setStatus(null);
    try {
      await studentsApi.downloadDocument(student.id, document.id, document.originalName);
    } catch (error) {
      setStatus({ tone: "danger", message: error instanceof Error ? error.message : "Download failed." });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((item) => (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl" key={item.value}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">{item.label}</p>
            <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{item.count}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-5 shadow-apple backdrop-blur-xl" onSubmit={handleUpload}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Upload document</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Type</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none transition focus:border-[#0071e3]"
                onChange={(event) => setType(event.target.value as DocumentType)}
                value={type}
              >
                {documentTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Name</span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none transition placeholder:text-[#86868b] focus:border-[#0071e3]"
                onChange={(event) => setName(event.target.value)}
                placeholder="Document name"
                type="text"
                value={name}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">File</span>
              <input
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="mt-1.5 w-full rounded-xl border border-dashed border-[rgba(0,0,0,0.14)] bg-[rgba(0,0,0,0.02)] px-3 py-3 text-[13px] font-medium text-[#6e6e73] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1d1d1f] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>

            {status ? (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-3">
                <StatusPill label={status.message} tone={status.tone} />
              </div>
            ) : null}

            <button
              className="w-full rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={uploading}
              type="submit"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 shadow-apple backdrop-blur-xl">
          <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Document audit trail</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Files are listed latest first with uploader and date metadata.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Name", "Type", "Uploaded by", "Date", "Size", "Action"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {documents.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No student documents uploaded yet.</td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr className="table-row" key={document.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{document.name}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">{document.originalName}</p>
                      </td>
                      <td className="px-5 py-4"><StatusPill label={typeLabel(document.type)} tone={typeTone(document.type)} /></td>
                      <td className="px-5 py-4 text-[#6e6e73]">{document.uploadedBy.fullName}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{formatDate(document.uploadedAt)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{formatBytes(document.sizeBytes)}</td>
                      <td className="px-5 py-4">
                        <button
                          className="rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] transition hover:bg-[rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={downloadingId === document.id}
                          onClick={() => handleDownload(document)}
                          type="button"
                        >
                          {downloadingId === document.id ? "Opening..." : "Download"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}
