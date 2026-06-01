"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreateStudentModal } from "./CreateStudentModal";

export default function NewStudentPage() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/students");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [router]);

  return (
    <CreateStudentModal
      onClose={() => router.back()}
      onCreated={() => {
        router.push("/students");
        router.refresh();
      }}
    />
  );
}
