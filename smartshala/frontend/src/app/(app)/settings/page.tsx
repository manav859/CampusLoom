import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title="School and notification settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-4 rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">School profile</h2>
          <input className="w-full rounded-lg border border-line px-3 py-2" defaultValue="SmartShala Demo Public School" />
          <input className="w-full rounded-lg border border-line px-3 py-2" defaultValue="Ahmedabad, Gujarat" />
          <button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
        <form className="space-y-4 rounded-lg border border-line bg-panel p-4">
          <h2 className="font-semibold">WhatsApp templates</h2>
          <textarea className="min-h-28 w-full rounded-lg border border-line px-3 py-2" defaultValue="Dear parent, {student_name} was absent today. Please contact the class teacher if needed." />
          <button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Save template</button>
        </form>
      </div>
    </div>
  );
}

