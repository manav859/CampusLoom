import { PageHeader } from "@/components/ui/PageHeader";
import { communicationTemplates, renderCommunicationTemplate } from "@/lib/communicationTemplates";

const previewVariables = {
  studentName: "Aarav Patel",
  className: "6-A",
  schoolName: "SmartShala Ahmedabad Public School",
  date: "14 May 2026",
  amount: "INR 2,500",
  dueDate: "20 May 2026",
  examName: "Unit Test 1",
  ptmTime: "10:00 AM",
  holidayReason: "school notice"
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="School and notification settings" />
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form className="glass-card-interactive p-6 space-y-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">School profile</h2>
          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">School name</label>
            <input className="glass-input mt-2" defaultValue="SmartShala Ahmedabad Public School" />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">Location</label>
            <input className="glass-input mt-2" defaultValue="Ahmedabad, Gujarat" />
          </div>
          <button className="btn-primary">Save</button>
        </form>
        <section className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">WhatsApp templates</h2>
          <p className="mt-1 text-[13px] text-[#86868b]">English and Hindi variants with live sample variables.</p>
          <div className="mt-5 grid gap-3">
            {communicationTemplates.map((template) => (
              <article className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-4" key={template.type}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1d1d1f]">{template.label}</h3>
                    <p className="text-[12px] font-medium text-[#86868b]">{template.description}</p>
                  </div>
                  <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[#6e6e73]">EN + HI</span>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <p className="rounded-lg bg-[#f5f5f7] p-3 text-[12px] leading-5 text-[#424245]">
                    {renderCommunicationTemplate(template.variants.en, previewVariables)}
                  </p>
                  <p className="rounded-lg bg-[#f5f5f7] p-3 text-[12px] leading-6 text-[#424245]">
                    {renderCommunicationTemplate(template.variants.hi, previewVariables)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
