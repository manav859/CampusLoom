import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/common/Logo';

/**
 * Premium Auth Layout for login/register pages.
 * Features a dynamic mesh background and consistent branding.
 */
export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* ─── Premium Mesh Background ─── */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] h-[30%] w-[30%] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <Logo size="lg" />
        </motion.div>

        <main className="w-full max-w-md">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
