import { redirect } from "next/navigation";

export default async function LegacyStudentFeeLedgerPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  redirect(`/fees/${studentId}`);
}
