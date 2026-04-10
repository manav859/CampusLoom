import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function PlaceholderPage({ title, description, icon: Icon = AlertCircle }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="text-base text-muted-foreground">{description}</p>}
      </div>
      
      <Card className="border-dashed shadow-none bg-muted/20 py-12">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-4 rounded-3xl bg-primary/10 p-5 text-primary">
            <Icon className="size-10" />
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="max-w-md text-base mt-2">
            This module is currently under development and will be available in an upcoming update.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground pb-4 mt-4">
          Wait for Phase 2 for full integration.
        </CardContent>
      </Card>
    </div>
  );
}
