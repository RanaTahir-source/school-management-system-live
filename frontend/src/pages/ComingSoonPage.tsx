import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This section is being polished and will be available soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
