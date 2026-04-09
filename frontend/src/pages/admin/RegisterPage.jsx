import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { UserPlus, AtSign, KeyRound, ArrowLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/features/auth/AuthContext';

const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

/**
 * Registration Page - Platform Enrollment.
 */
export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    try {
      await registerUser(data.email, data.password);
      navigate('/login', { replace: true });
    } catch (error) {
      setError('root', { 
        type: 'manual', 
        message: error.message || 'Registration failed'
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-6 flex items-center justify-between px-1">
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3" />
          Back to Login
        </Link>
        
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/40">
          <Link 
            to="/login" 
            className="transition-colors hover:text-primary"
          >
            Login
          </Link>
          <span className="text-muted-foreground/20">|</span>
          <span className="text-primary">Register</span>
        </div>
      </div>

      <Card className="glass shadow-premium border-white/20 dark:border-white/5 overflow-hidden">
        <CardHeader className="text-center space-y-2 pt-10 px-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
            <UserPlus className="size-7" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">Create Account</CardTitle>
          <CardDescription>Begin your journey with CampusLoom today.</CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errors.root && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs text-destructive font-bold"
              >
                <AlertCircle className="size-4 shrink-0" />
                {errors.root.message}
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="group relative">
                <AtSign className={`absolute top-4 left-4 size-4 transition-colors duration-300 ${errors.email ? 'text-destructive' : 'text-muted-foreground/40 group-focus-within:text-primary'}`} />
                <input 
                  type="email" 
                  placeholder="Your Email Address"
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
                  placeholder="Create Secure Password" 
                  autoComplete="new-password"
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
                  Creating Account <Loader2 className="ml-2 size-4 animate-spin" />
                </>
              ) : (
                <>
                  Register Portal <ChevronRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

      </Card>
      
    </motion.div>
  );
}
