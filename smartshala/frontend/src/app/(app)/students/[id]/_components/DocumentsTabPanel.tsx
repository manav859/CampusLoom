"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { MarqueeText } from "@/components/ui/KpiCard";
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
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{ tone: "good" | "warn" | "danger"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(document: StudentDocument) {
    if (!window.confirm(`Delete "${document.name}"? This permanently removes the file.`)) return;
    setDeletingId(document.id);
    setStatus(null);
    try {
      await studentsApi.deleteDocument(student.id, document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setStatus({ tone: "good", message: "Document deleted." });
    } catch (error) {
      setStatus({ tone: "danger", message: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((item) => (
          <div className="kpi-metric-card min-w-0 overflow-hidden p-4" key={item.label}>
            <p className="kpi-metric-label">{item.label}</p>
            <p className="kpi-metric-value">{item.count}</p>
            <MarqueeText text={item.types.map(typeLabel).join(", ")} className="mt-1 text-[11px] font-medium leading-4 text-[#86868b]" />
          </div>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5" onSubmit={handleUpload}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Upload Document</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Type</span>
              <select
                className="mt-1.5 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none transition focus:border-[#2456E6]"
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
                className="mt-1.5 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none transition placeholder:text-[#86868b] focus:border-[#2456E6]"
                onChange={(event) => setName(event.target.value)}
                placeholder="Document name"
                type="text"
                value={name}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">File</span>
              <div
                className={`mt-1.5 rounded-[6px] border border-dashed px-4 py-5 text-center transition ${
                  dragActive ? "border-[#2456E6] bg-[#E2F0FB]" : "border-[#C9D3DE] bg-[#F7F8FB]"
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

            {status ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-3">
                <StatusPill label={status.message} tone={status.tone} />
              </div>
            ) : null}

            <button
              className="w-full rounded-[6px] bg-[#2456E6] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={uploading}
              type="submit"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
          <div className="border-b border-[#E7EBF0] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Document Audit Trail</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Files are listed latest first with uploader and date metadata.</p>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {documents.length === 0 ? (
              <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No student documents uploaded yet.</div>
            ) : (
              documents.map((document) => (
                <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-doc-${document.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-[#0F1419]">{document.name}</h3>
                      <p className="mt-1 truncate text-[12px] font-medium text-[#5A6573]">{document.originalName}</p>
                    </div>
                    <StatusPill label={typeLabel(document.type)} tone={typeTone(document.type)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Uploaded By</p><p className="mt-1 truncate font-bold text-[#0F1419]">{document.uploadedBy.fullName}</p></div>
                    <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Size</p><p className="mt-1 font-bold text-[#0F1419]">{formatBytes(document.sizeBytes)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-2 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-50" disabled={downloadingId === document.id} onClick={() => handleDownload(document)} type="button">
                      {downloadingId === document.id ? "Opening..." : "Download"}
                    </button>
                    <button className="flex-1 rounded-[6px] border border-[#E2B4B4] bg-white px-3 py-2 text-[12px] font-semibold text-[#C0322B] hover:bg-[#FBF1F1] disabled:cursor-not-allowed disabled:opacity-50" disabled={deletingId === document.id} onClick={() => handleDelete(document)} type="button">
                      {deletingId === document.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
              <thead>
                <tr className="table-head-row">
                  {["Name", "Type", "Uploaded By", "Date", "Size", "Action"].map((head) => (
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No student documents uploaded yet.</td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr className="transition-colors duration-200 hover:bg-[#F8FBFD]" key={document.id}>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                        <p className="font-semibold text-[#1d1d1f]">{document.name}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">{document.originalName}</p>
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center"><StatusPill label={typeLabel(document.type)} tone={typeTone(document.type)} /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{document.uploadedBy.fullName}</td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{formatDateTimeShort(document.uploadedAt)}</td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{formatBytes(document.sizeBytes)}</td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] transition hover:bg-[rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={downloadingId === document.id}
                            onClick={() => handleDownload(document)}
                            type="button"
                          >
                            {downloadingId === document.id ? "Opening..." : "Download"}
                          </button>
                          <button
                            className="rounded-lg border border-[#E2B4B4] px-3 py-1.5 text-[12px] font-semibold text-[#C0322B] transition hover:bg-[#FBF1F1] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={deletingId === document.id}
                            onClick={() => handleDelete(document)}
                            type="button"
                          >
                            {deletingId === document.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
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
