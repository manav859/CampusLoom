import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, ChevronRight, FileText, Send, UserCheck, Calendar } from 'lucide-react';

const STEPS = [
  { icon: FileText, title: 'Application', description: 'Submit your online application through our digital portal.' },
  { icon: UserCheck, title: 'Interview', description: 'Schedule a discovery session with our faculty members.' },
  { icon: CheckCircle2, title: 'Decision', description: 'Receive your formal admission results via your registered email.' },
];

/**
 * Admissions Page - Digital Enrollment Process.
 * Premium timeline layout with high-performance reveal motions.
 */
export default function AdmissionsPage() {
  return (
    <div className="space-y-24 pb-24">
      {/* ─── Hero Header ─── */}
      <section className="bg-primary py-20 px-6 text-primary-foreground">
        <div className="mx-auto max-w-4xl text-center reveal">
           <div className="mb-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Admissions 2026</div>
           <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
             Begin Your <span className="text-accent underline decoration-accent/30 underline-offset-8">Journey</span>.
           </h1>
           <p className="mt-8 text-lg text-primary-foreground/70 leading-relaxed sm:text-xl">
             Our enrollment process is designed to be as seamless and transparent as our classroom experience. 
             Start your digital application today.
           </p>
        </div>
      </section>

      {/* ─── Timeline Steps ─── */}
      <section className="mx-auto max-w-7xl px-8">
        <div className="grid gap-12 lg:grid-cols-3">
          {STEPS.map((step, idx) => (
            <div key={step.title} className="group relative flex flex-col items-center text-center reveal">
               <div className="z-10 flex size-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/20 transition-transform group-hover:scale-110">
                  <step.icon className="size-8" />
               </div>
               {/* Connector Line (Desktop) */}
               {idx < STEPS.length - 1 && (
                  <div className="absolute top-10 left-[60%] hidden h-[2px] w-full bg-primary/10 lg:block" />
               )}
               <div className="mt-8 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-primary/60">Step 0{idx + 1}</div>
                  <h3 className="text-2xl font-bold tracking-tight">{step.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Card ─── */}
      <section className="mx-auto max-w-5xl px-8">
         <Card className="reveal relative overflow-hidden border-none bg-muted/40 p-10 text-center shadow-none hover:bg-card hover:shadow-premium">
            <div className="absolute top-0 right-0 h-40 w-40 opacity-5 bg-[radial-gradient(circle_at_100%_0%,var(--color-primary)_0%,transparent_70%)]" />
            <CardHeader className="space-y-4">
               <Calendar className="mx-auto size-12 text-primary opacity-40" />
               <CardTitle className="text-3xl font-bold">Ready to take the next step?</CardTitle>
               <CardDescription className="mx-auto max-w-lg text-base">
                 Digital application portals are open until August 15th for the Fall Term. 
                 Complete your profile in less than 15 minutes.
               </CardDescription>
            </CardHeader>
            <CardContent className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
               <Button size="lg" className="rounded-full px-12 h-14">
                 Apply Online <ChevronRight className="ml-2 size-5" />
               </Button>
               <Button variant="ghost" size="lg" className="rounded-full px-12">
                 Download Brochure
               </Button>
            </CardContent>
         </Card>
      </section>
    </div>
  );
}
