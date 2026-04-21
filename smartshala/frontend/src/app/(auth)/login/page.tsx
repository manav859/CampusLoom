import Image from "next/image";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold text-action">SmartShala V1</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">School operations, ready before assembly.</h1>
          <p className="mt-3 text-neutral-600">Login for principal and teacher teams. Parents receive WhatsApp updates only.</p>
          <LoginForm />
        </div>
      </section>
      <section className="relative hidden min-h-screen lg:block">
        <Image
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=80"
          alt="School campus"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/30" />
      </section>
    </main>
  );
}

