import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LogIn, AtSign, KeyRound, ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Logo from '@/components/common/Logo';
import { useAuth } from '@/features/auth/AuthContext';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Admin Login Page - Premium Portal Access.
 * Features specialized input states, shadow-premium layout, and reveal entrance.
 * 
 * Supports full validation with react-hook-form & zod.
 * Integrates with AuthContext for secured portal access.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/admin';
  
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (error) {
      setError('root', { 
        type: 'manual', 
        message: error.message || 'Invalid credentials'
      });
    }
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
               <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {errors.root && (
                    <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
                      <AlertCircle className="size-4" />
                      {errors.root.message}
                    </div>
                  )}

                  <div className="space-y-4">
                     <div>
                       <div className="relative">
                          <AtSign className={`absolute top-3.5 left-4 size-5 text-muted-foreground opacity-40 ${errors.email ? 'text-destructive opacity-100' : ''}`} />
                          <input 
                             type="email" 
                             placeholder="Administrator Email"
                             autoComplete="email"
                             className={`w-full h-12 rounded-xl bg-muted/40 border-none pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60 ${errors.email ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''}`}
                             {...register('email')}
                          />
                       </div>
                       {errors.email && <p className="mt-1.5 ml-1 text-xs text-destructive font-medium">{errors.email.message}</p>}
                     </div>
                     
                     <div>
                       <div className="relative">
                          <KeyRound className={`absolute top-3.5 left-4 size-5 text-muted-foreground opacity-40 ${errors.password ? 'text-destructive opacity-100' : ''}`} />
                          <input 
                             type="password" 
                             placeholder="Access Secret Key" 
                             autoComplete="current-password"
                             className={`w-full h-12 rounded-xl bg-muted/40 border-none pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60 ${errors.password ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''}`}
                             {...register('password')}
                          />
                       </div>
                       {errors.password && <p className="mt-1.5 ml-1 text-xs text-destructive font-medium">{errors.password.message}</p>}
                     </div>
                  </div>
                  
                  <Button type="submit" size="lg" disabled={isSubmitting} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20 mt-2">
                     {isSubmitting ? (
                        <>
                           Verifying <Loader2 className="ml-2 size-4 animate-spin" />
                        </>
                     ) : (
                        <>
                           Authorize Access <ChevronRight className="ml-2 size-4" />
                        </>
                     )}
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
