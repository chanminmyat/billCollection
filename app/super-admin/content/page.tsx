import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const contentBlocks = [
  { title: 'Welcome Message', status: 'Published', summary: 'Intro text shown on first login.' },
  { title: 'FAQ Section', status: 'Draft', summary: 'Common questions for onboarding.' },
  { title: 'Policy Banner', status: 'Published', summary: 'Visible across dashboards.' }
];

export default function SuperAdminContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Content Management</h2>
        <p className="text-sm text-slate-500">Control messaging for admin, collector, and customer.</p>
      </div>

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="collector">Collector</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
        </TabsList>

        {['admin', 'collector', 'customer'].map((role) => (
          <TabsContent key={role} value={role} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">
                {role.charAt(0).toUpperCase() + role.slice(1)} content blocks
              </p>
              <Button variant="outline" size="sm">
                Add Block
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {contentBlocks.map((block) => (
                <Card key={`${role}-${block.title}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{block.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-600">
                    <p>{block.summary}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{block.status}</span>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
