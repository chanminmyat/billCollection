import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Wifi } from 'lucide-react';

const packages = [
  { name: 'Basic 25 Mbps', price: '12,000 MMK', speed: '25/5 Mbps', status: 'active' },
  { name: 'Standard 50 Mbps', price: '18,000 MMK', speed: '50/10 Mbps', status: 'active' },
  { name: 'Premium 100 Mbps', price: '25,000 MMK', speed: '100/20 Mbps', status: 'active' },
  { name: 'Enterprise 200 Mbps', price: '45,000 MMK', speed: '200/50 Mbps', status: 'draft' }
];

export default function SuperAdminPackagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">WiFi Packages</h2>
          <p className="text-sm text-slate-500">Plan catalog and pricing rules.</p>
        </div>
        <Button className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="mr-2 h-4 w-4" />
          New Package
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((item) => (
          <Card key={item.name}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{item.name}</CardTitle>
              <Wifi className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold text-slate-900">{item.price}</div>
              <div className="text-sm text-slate-500">{item.speed}</div>
              <div className="flex items-center justify-between">
                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
