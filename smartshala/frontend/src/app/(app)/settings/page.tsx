import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="School and notification settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="glass-card-interactive p-6 space-y-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">School profile</h2>
          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">School name</label>
            <input className="glass-input mt-2" defaultValue="SmartShala Demo Public School" />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">Location</label>
            <input className="glass-input mt-2" defaultValue="Ahmedabad, Gujarat" />
          </div>
          <button className="btn-primary">Save</button>
        </form>
        <form className="glass-card-interactive p-6 space-y-5">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">WhatsApp templates</h2>
          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">Absence notification</label>
            <textarea className="glass-input mt-2 min-h-[120px] py-3 resize-none" defaultValue="Dear parent, {student_name} was absent today. Please contact the class teacher if needed." />
          </div>
          <button className="btn-primary">Save template</button>
        </form>
      </div>
    </div>
  );
}
