import { Link, isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

function getErrorContent(error) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Page not found',
        message: 'The page you requested does not exist or is not available in this environment.',
      };
    }

    return {
      title: 'Unable to open this page',
      message: 'The route could not be loaded safely. Please try again from a stable entry point.',
    };
  }

  return {
    title: 'Something went wrong',
    message: 'The application hit an unexpected problem while rendering this route.',
  };
}

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const { title, message } = getErrorContent(error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-4">
        <ErrorState title={title} message={message} actionLabel="Go back" onAction={() => navigate(-1)} />
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to={isAdminRoute ? '/admin' : '/'}>{isAdminRoute ? 'Go to dashboard' : 'Go home'}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
