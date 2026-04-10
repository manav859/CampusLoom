import { Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion as Motion } from 'framer-motion';
import { LogIn, AtSign, KeyRound, ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/features/auth/AuthContext';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

function getRoleHome(role) {
  return role === 'admin' ? '/admin' : '/account';
}

function getLoginDestination(user, fromPathname) {
  const roleHome = getRoleHome(user?.role);

  if (!fromPathname) {
    return roleHome;
  }

  if (user?.role === 'admin' && fromPathname.startsWith('/admin')) {
    return fromPathname;
  }

  if ((user?.role === 'student' || user?.role === 'teacher') && fromPathname.startsWith('/account')) {
    return fromPathname;
  }

  return roleHome;
}

/**
 * Shared Login Page for admin, student, and teacher accounts.
 * Features specialized input states and coordinated entrance.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const { isAuthenticated, user } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated && user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  const onSubmit = async (data) => {
    try {
      const authenticatedUser = await login(data.email, data.password);
      navigate(getLoginDestination(authenticatedUser, from), { replace: true });
    } catch (error) {
      setError('root', { 
        type: 'manual', 
        message: error.message || 'Invalid credentials'
      });
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-6 flex items-center justify-between px-1">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3" />
          Back to CampusLoom
        </Link>

        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/40">
          <span className="text-primary">Login</span>
          <span className="text-muted-foreground/20">|</span>
          <Link 
            to="/register" 
            className="transition-colors hover:text-primary"
          >
            Register
          </Link>
        </div>
      </div>

      <Card className="glass shadow-premium border-white/20 dark:border-white/5 overflow-hidden">
        <CardHeader className="text-center space-y-2 pt-10 px-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
            <LogIn className="size-7" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">Sign In</CardTitle>
          <CardDescription>Access your CampusLoom workspace as an admin, student, or teacher.</CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-8 pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errors.root && (
              <Motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs text-destructive font-bold"
              >
                <AlertCircle className="size-4 shrink-0" />
                {errors.root.message}
              </Motion.div>
            )}

            <div className="space-y-4">
              <div className="group relative">
                <AtSign className={`absolute top-4 left-4 size-4 transition-colors duration-300 ${errors.email ? 'text-destructive' : 'text-muted-foreground/40 group-focus-within:text-primary'}`} />
                <input 
                  type="email" 
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full h-12 rounded-xl bg-muted/20 border border-border/50 pl-11 pr-4 text-sm outline-none transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 ${errors.email ? 'border-destructive/50 bg-destructive/5' : 'focus:border-primary'}`}
                  {...register('email')}
                />
                {errors.email && <p className="mt-1.5 ml-1 text-[10px] text-destructive font-black uppercase tracking-wider">{errors.email.message}</p>}
              </div>
              
              <div className="group relative">
                <KeyRound className={`absolute top-4 left-4 size-4 transition-colors duration-300 ${errors.password ? 'text-destructive' : 'text-muted-foreground/40 group-focus-within:text-primary'}`} />
                <input 
                  type="password" 
                  placeholder="Enter your password" 
                  autoComplete="current-password"
                  className={`w-full h-12 rounded-xl bg-muted/20 border border-border/50 pl-11 pr-4 text-sm outline-none transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 ${errors.password ? 'border-destructive/50 bg-destructive/5' : 'focus:border-primary'}`}
                  {...register('password')}
                />
                {errors.password && <p className="mt-1.5 ml-1 text-[10px] text-destructive font-black uppercase tracking-wider">{errors.password.message}</p>}
              </div>
            </div>
            <Button 
              type="submit" 
              size="lg" 
              disabled={isSubmitting} 
              className="w-full rounded-xl h-12 font-bold shadow-xl shadow-primary/20 mt-2 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  Signing In <Loader2 className="ml-2 size-4 animate-spin" />
                </>
              ) : (
                <>
                  Continue to Workspace <ChevronRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

      </Card>
      
    </Motion.div>
  );
}
