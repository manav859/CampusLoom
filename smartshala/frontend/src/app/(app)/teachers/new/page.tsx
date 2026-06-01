"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreateTeacherModal } from "./CreateTeacherModal";

export default function NewTeacherPage() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/teachers");
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [router]);

  return (
    <CreateTeacherModal
      onClose={() => router.back()}
      onCreated={() => {
        router.push("/teachers");
        router.refresh();
      }}
    />
  );
}
