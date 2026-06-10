import { AuthGuard } from "@/components/layout/AuthGuard";
import ChatWidget from "@/components/chat/ChatWidget";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <ChatWidget />
    </AuthGuard>
  );
}

