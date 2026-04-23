import Image from "next/image";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      {/* Left - Form */}
      <section className="flex items-center justify-center px-6 py-12 bg-[#f5f5f7]">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0071e3] to-[#34c759]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">SmartShala</span>
          </div>

          <h1 className="text-[34px] font-semibold tracking-tight text-[#1d1d1f] leading-[1.1]">
            School operations,<br />ready before assembly.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">
            Login for principal and teacher teams. Parents receive WhatsApp updates only.
          </p>
          <LoginForm />
        </div>
      </section>

      {/* Right - Image */}
      <section className="relative hidden min-h-screen lg:block">
        <Image
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=80"
          alt="School campus"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-[32px] font-semibold text-white tracking-tight leading-tight">
            Empowering education<br />with clarity and insight.
          </p>
          <p className="mt-3 text-[15px] text-white/70">
            SmartShala Campus ERP — Attendance, Fees, Analytics.
          </p>
        </div>
      </section>
    </main>
  );
}
