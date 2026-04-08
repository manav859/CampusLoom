import { SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6 py-12">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you are looking for is unavailable or may have moved."
        actionLabel="Back to home"
        onAction={() => navigate('/', { replace: true })}
      />
    </div>
  );
}
