import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Contact Page - Communication Hub.
 * Clean, grid-based layout with premium shadow-premium and reveal effects.
 */
export default function ContactPage() {
  return (
    <div className="space-y-24 pb-24">
      {/* ─── Hero Header ─── */}
      <section className="bg-muted/30 py-20 px-6">
        <div className="mx-auto max-w-4xl text-center reveal">
           <div className="mb-4 text-xs font-bold tracking-[0.3em] text-primary uppercase">Contact Us</div>
           <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
             We're Here to <span className="text-primary italic">Connect</span>.
           </h1>
           <p className="mt-8 text-lg text-muted-foreground leading-relaxed sm:text-xl">
             Whether you're a parent, a student, or a partner, we'd love to hear from you. 
             Reach out today or visit our campus.
           </p>
        </div>
      </section>

      {/* ─── Contact Grid ─── */}
      <section className="mx-auto max-w-7xl px-8">
        <div className="grid gap-12 lg:grid-cols-2">
           {/* Direct Channels */}
           <div className="space-y-8 reveal">
              <h2 className="text-3xl font-bold tracking-tight">Direct Channels</h2>
              <div className="grid gap-6">
                 {[
                   { icon: Mail, label: 'Email Support', value: 'hello@campusloom.edu' },
                   { icon: Phone, label: 'Phone Registry', value: '+1 (555) 000-0000' },
                   { icon: MapPin, label: 'Campus Address', value: '1 Scholar Way, Knowledge Valley' }
                 ].map(item => (
                   <Card key={item.label} className="border-none bg-muted/50 p-6 shadow-none hover:bg-card hover:shadow-premium">
                      <div className="flex items-center gap-4">
                         <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <item.icon className="size-6" />
                         </div>
                         <div>
                            <div className="text-xs font-bold uppercase tracking-widest opacity-60">{item.label}</div>
                            <div className="text-lg font-semibold">{item.value}</div>
                         </div>
                      </div>
                   </Card>
                 ))}
              </div>
           </div>

           {/* Quick Message Form */}
           <div className="reveal">
              <Card className="shadow-premium border-none bg-card p-10">
                 <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-2xl">Send a Message</CardTitle>
                    <CardDescription>Our administration team typically responds within 24 hours.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-0 space-y-6">
                    <div className="space-y-4">
                       <input 
                         type="text" 
                         placeholder="Full Name" 
                         className="w-full h-12 rounded-xl bg-muted/50 border-none px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                       />
                       <input 
                         type="email" 
                         placeholder="Email Address" 
                         className="w-full h-12 rounded-xl bg-muted/50 border-none px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                       />
                       <textarea 
                         placeholder="Your Message..." 
                         rows={4}
                         className="w-full rounded-xl bg-muted/50 border-none p-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                       />
                    </div>
                    <Button size="lg" className="w-full rounded-full">
                       Submit Inquiry <Send className="ml-2 size-4" />
                    </Button>
                 </CardContent>
              </Card>
           </div>
        </div>
      </section>
    </div>
  );
}
