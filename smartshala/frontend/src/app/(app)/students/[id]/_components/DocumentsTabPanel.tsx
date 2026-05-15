"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { studentsApi, type StudentDetail, type StudentDocumentUploadPayload } from "@/lib/api";
import { formatDateTimeShort } from "@/lib/formatters";

export type DocumentsTabPanelProps = {
  student: StudentDetail;
};

type StudentDocument = StudentDetail["documents"][number];
type DocumentType = StudentDocument["type"];

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "APAAR", label: "APAAR ID" },
  { value: "BIRTH_CERTIFICATE", label: "Birth Certificate" },
  { value: "CASTE_CERTIFICATE", label: "Caste Certificate" },
  { value: "TRANSFER_CERTIFICATE", label: "Transfer Certificate" },
  { value: "BONAFIDE", label: "Bonafide" },
  { value: "MEDICAL", label: "Medical" },
  { value: "REPORT_CARD", label: "Report Card" },
  { value: "PHOTO", label: "Photo" },
  { value: "CERTIFICATE", label: "Other Certificate" },
  { value: "PARENT_ID", label: "Parent ID" },
  { value: "AGREEMENT", label: "Agreements" }
];

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(type: DocumentType) {
  return documentTypes.find((item) => item.value === type)?.label ?? type;
}

function typeTone(type: DocumentType) {
  if (type === "CERTIFICATE" || type === "BIRTH_CERTIFICATE" || type === "CASTE_CERTIFICATE" || type === "TRANSFER_CERTIFICATE" || type === "BONAFIDE" || type === "REPORT_CARD") return "good";
  if (type === "MEDICAL") return "warn";
  if (type === "AADHAAR" || type === "APAAR") return "neutral";
  return "neutral";
}

const counterGroups = [
  { label: "Identity", types: ["AADHAAR", "APAAR", "PARENT_ID", "PHOTO"] as DocumentType[] },
  { label: "Admission", types: ["BIRTH_CERTIFICATE", "CASTE_CERTIFICATE", "TRANSFER_CERTIFICATE", "BONAFIDE"] as DocumentType[] },
  { label: "Academic", types: ["REPORT_CARD", "CERTIFICATE"] as DocumentType[] },
  { label: "Medical & agreements", types: ["MEDICAL", "AGREEMENT"] as DocumentType[] }
];

export default function DocumentsTabPanel({ student }: DocumentsTabPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>(student.documents ?? []);
  const [type, setType] = useState<DocumentType>("AADHAAR");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [shareWithParent, setShareWithParent] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{ tone: "good" | "warn" | "danger"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      counterGroups.map((item) => ({
        ...item,
        count: documents.filter((document) => item.types.includes(document.type)).length
      })),
    [documents]
  );

  function validateAndSetFile(nextFile: File | null) {
    if (!nextFile) {
      setFile(null);
      return;
    }

    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    const allowedExtensions = /\.(pdf|jpe?g|png)$/i;
    if (!allowedTypes.has(nextFile.type) && !allowedExtensions.test(nextFile.name)) {
      setStatus({ tone: "danger", message: "Use PDF, JPG, or PNG files only." });
      return;
    }

    if (nextFile.size > 5 * 1024 * 1024) {
      setStatus({ tone: "danger", message: "File must be 5MB or smaller." });
      return;
    }

    setStatus(null);
    setFile(nextFile);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
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
      form.reset();
      setStatus({ tone: "good", message: shareWithParent ? "Document uploaded and marked for parent sharing." : "Document uploaded." });
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
          <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white/90 p-4 shadow-apple-sm backdrop-blur-xl" key={item.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">{item.label}</p>
            <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{item.count}</p>
            <p className="mt-1 text-[11px] font-medium text-[#86868b]">{item.types.map(typeLabel).join(", ")}</p>
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
              <div
                className={`mt-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition ${
                  dragActive ? "border-[#2456E6] bg-[#E2F0FB]" : "border-[rgba(0,0,0,0.14)] bg-[rgba(0,0,0,0.02)]"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  validateAndSetFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mx-auto block max-w-full text-[13px] font-medium text-[#6e6e73] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1d1d1f] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white"
                  onChange={(event) => validateAndSetFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <p className="mt-3 text-[13px] font-semibold text-[#1d1d1f]">
                  {file ? file.name : "Drag and drop a document here"}
                </p>
                <p className="mt-1 text-[12px] font-medium text-[#86868b]">PDF, JPG, PNG up to 5MB</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f5f5f7] px-4 py-3">
              <input
                checked={shareWithParent}
                className="mt-1 h-4 w-4 accent-[#2456E6]"
                onChange={(event) => setShareWithParent(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-[13px] font-semibold text-[#1d1d1f]">Share with parent</span>
                <span className="block text-[12px] font-medium text-[#86868b]">Marks this upload as parent-facing once sharing rules are enabled.</span>
              </span>
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
                      <td className="px-5 py-4 text-[#6e6e73]">{formatDateTimeShort(document.uploadedAt)}</td>
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
