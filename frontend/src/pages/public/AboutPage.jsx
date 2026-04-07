import { Card, CardContent } from '@/components/ui/card';
import { Award, BookOpen, Heart, Music, Target, Users } from 'lucide-react';

const VALUES = [
  { icon: Target, title: 'Vision', description: 'To be a global leader in progressive, technology-driven education.' },
  { icon: Heart, title: 'Values', description: 'Integrity, empathy, and lifelong curiosity are the pillars of our community.' },
  { icon: Award, title: 'Excellence', description: 'Striving for perfection in every academic and extracurricular pursuit.' },
];

/**
 * About Page - Mission & Values.
 * Clean, scholarly layout with entrance reveal effects.
 */
export default function AboutPage() {
  return (
    <div className="space-y-24 pb-24">
      {/* ─── Hero Header ─── */}
      <section className="bg-muted/30 py-20 px-6">
        <div className="mx-auto max-w-4xl text-center reveal">
           <div className="mb-4 text-xs font-bold tracking-[0.3em] text-primary uppercase">About CampusLoom</div>
           <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
             Our Mission is to <span className="text-primary italic">Loom</span> the Future.
           </h1>
           <p className="mt-8 text-lg text-muted-foreground leading-relaxed sm:text-xl">
             Founded in 2024, CampusLoom was built on the principle that modern education 
             requires a modern infrastructure. We blend academic rigor with digital fluency.
           </p>
        </div>
      </section>

      {/* ─── Story Section ─── */}
      <section className="mx-auto max-w-7xl px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
           <div className="space-y-6 reveal">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Excellence in Every Thread</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                At CampusLoom, we believe that education is not just about transferring knowledge; 
                it's about weaving a complex fabric of skills, character, and vision. 
                Our platform provides the loom upon which educators and students craft their futures.
              </p>
              <div className="grid grid-cols-2 gap-4">
                 <div className="rounded-2xl bg-muted/50 p-6">
                    <div className="text-3xl font-black text-primary">98%</div>
                    <div className="text-xs font-bold uppercase tracking-widest opacity-60">Success Rate</div>
                 </div>
                 <div className="rounded-2xl bg-muted/50 p-6">
                    <div className="text-3xl font-black text-primary">50+</div>
                    <div className="text-xs font-bold uppercase tracking-widest opacity-60">Expert Faculty</div>
                 </div>
              </div>
           </div>
           {/* Image Placeholder */}
           <div className="aspect-video rounded-3xl bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center reveal">
              <span className="text-primary font-medium opacity-40 italic">Campus Photography Placeholder</span>
           </div>
        </div>
      </section>

      {/* ─── Values Grid ─── */}
      <section className="mx-auto max-w-7xl px-8">
         <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(value => (
              <Card key={value.title} className="reveal border-none bg-muted/30 shadow-none hover:bg-card">
                 <CardContent className="space-y-4">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover/card:scale-110">
                       <value.icon className="size-7" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-xl font-bold">{value.title}</h3>
                       <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                    </div>
                 </CardContent>
              </Card>
            ))}
         </div>
      </section>
    </div>
  );
}
