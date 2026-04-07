import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AtSign, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Logo from '@/components/common/Logo';

/**
 * Admin Login Page - Premium Portal Access.
 * Features specialized input states, shadow-premium layout, and reveal entrance.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Phase 2 — Implementation of real auth
    // For now, mock navigate to admin dashboard
    navigate('/admin');
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* ─── Background Accents ─── */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-primary)_0%,transparent_50%)] opacity-[0.03]" />
      
      {/* ─── Back Link ─── */}
      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-all hover:text-primary reveal">
         <ArrowLeft className="size-4" />
         Back to Home
      </Link>

      {/* ─── Login Canvas ─── */}
      <div className="relative w-full max-w-md reveal">
         <div className="mb-8 flex justify-center">
            <Logo size="lg" />
         </div>

         <Card className="shadow-premium border-none bg-card p-1">
            <CardHeader className="text-center space-y-2 pt-10 px-8">
               <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                  <LogIn className="size-7" />
               </div>
               <CardTitle className="text-2xl font-black tracking-tight">Admin Portal</CardTitle>
               <CardDescription>Enter your administrative credentials to continue.</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-6">
               <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-4">
                     <div className="relative">
                        <AtSign className="absolute top-3.5 left-4 size-5 text-muted-foreground opacity-40" />
                        <input 
                           type="email" 
                           placeholder="Administrator Email" 
                           required
                           className="w-full h-12 rounded-xl bg-muted/40 border-none pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60"
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                        />
                     </div>
                     <div className="relative">
                        <KeyRound className="absolute top-3.5 left-4 size-5 text-muted-foreground opacity-40" />
                        <input 
                           type="password" 
                           placeholder="Access Secret Key" 
                           required
                           className="w-full h-12 rounded-xl bg-muted/40 border-none pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                        />
                     </div>
                  </div>
                  <Button type="submit" size="lg" className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20 mt-2">
                     Authorize Access <ChevronRight className="ml-2 size-4" />
                  </Button>
               </form>
            </CardContent>
            <CardFooter className="justify-center border-t py-6 bg-muted/20 rounded-b-2xl">
               <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-50">
                  © 2026 CampusLoom Secure Infrastructure
               </p>
            </CardFooter>
         </Card>
      </div>
    </div>
  );
}

import { ChevronRight } from 'lucide-react';
