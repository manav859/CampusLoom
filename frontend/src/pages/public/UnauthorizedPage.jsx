import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-none text-center">
        <CardHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">Access restricted</CardTitle>
            <CardDescription>
              Your account is authenticated but does not have permission to access this area.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/">Return to public site</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
