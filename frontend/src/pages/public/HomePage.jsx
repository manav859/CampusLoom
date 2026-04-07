import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Academic Excellence',
    description: 'Comprehensive curriculum designed to bring out the best in every student.',
  },
  {
    icon: Users,
    title: 'Expert Faculty',
    description: 'Dedicated teachers with years of experience in modern education.',
  },
  {
    icon: Award,
    title: 'Proven Results',
    description: 'Consistently outstanding academic and extracurricular achievements.',
  },
];

/**
 * Public Home Page.
 * Sophisticated hero + feature showcase with premium reveal motion.
 */
export default function HomePage() {
  return (
    <div className="space-y-24 pb-24">
      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,var(--color-primary)_0%,transparent_50%)] opacity-[0.03]" />
        
        <div className="relative mx-auto max-w-5xl text-center reveal">
          <div className="mb-6 inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold tracking-widest text-primary uppercase">
            New for 2026 Academic Year
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Education for the{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Digital Generation
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            CampusLoom provides an integrated digital ecosystem for progressive schools, 
            blending modern technology with timeless educational values.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="rounded-full px-10" asChild>
              <Link to="/admissions">
                Start Admission <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-10" asChild>
              <Link to="/about">Explore Campus</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Feature Showcase ─── */}
      <section className="mx-auto max-w-7xl px-8">
        <div className="mb-16 flex flex-col items-center text-center">
             <div className="mb-4 text-xs font-bold tracking-[0.2em] text-primary uppercase">Advantages</div>
             <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Built for Modern Institutions</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => (
            <Card key={feature.title} className="reveal border-none bg-muted/30 shadow-none hover:bg-card hover:shadow-premium">
              <CardContent className="space-y-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover/card:scale-110">
                  <feature.icon className="size-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
