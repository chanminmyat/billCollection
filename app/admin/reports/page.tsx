'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, FileText, Users, DollarSign, TrendingUp } from 'lucide-react';
import { useData } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';

export default function ReportsPage() {
  const { customers, bills, payments, collectors } = useData();
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  // Calculate metrics
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = bills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + b.amount, 0);
  const collectionRate = bills.length > 0 ? (bills.filter(b => b.status === 'paid').length / bills.length * 100) : 0;
  const activeCustomers = customers.filter(c => c.status === 'active').length;

  // Collector performance data
  const collectorPerformance = collectors.map(collector => {
    const collectorPayments = payments.filter(p => p.collectorId === collector.id);
    const totalCollected = collectorPayments.reduce((sum, p) => sum + p.amount, 0);
    const assignedBills = bills.filter(b => b.collectorId === collector.id);
    const collectedBills = assignedBills.filter(b => b.status === 'paid');
    const collectionRate = assignedBills.length > 0 ? (collectedBills.length / assignedBills.length * 100) : 0;

    return {
      name: collector.name,
      totalCollected,
      collectionRate,
      assignedCustomers: customers.filter(c => c.collectorId === collector.id).length
    };
  });

  // Monthly revenue trend
  const monthlyRevenue = [
    { month: 'Jan', revenue: 2400 },
    { month: 'Feb', revenue: 2100 },
    { month: 'Mar', revenue: 2800 },
    { month: 'Apr', revenue: 2600 },
    { month: 'May', revenue: 3200 },
    { month: 'Jun', revenue: 2900 },
  ];

  const handleExportPDF = () => {
    console.log('Exporting PDF report...');
    // Simulate PDF export
    alert('PDF report exported successfully!');
  };

  const handleExportExcel = () => {
    console.log('Exporting Excel report...');
    // Simulate Excel export
    alert('Excel report exported successfully!');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600">Business insights and performance metrics</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                +12.5% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Pending collections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collectionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Bills collected on time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCustomers}</div>
              <p className="text-xs text-muted-foreground">
                Currently subscribed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Select defaultValue="this-month">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all-collectors">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select collector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-collectors">All Collectors</SelectItem>
                  {collectors.map((collector) => (
                    <SelectItem key={collector.id} value={collector.id}>
                      {collector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collector Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={collectorPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="totalCollected" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Collector Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {collectorPerformance.map((collector) => (
                  <div key={collector.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{collector.name}</div>
                      <div className="text-sm text-gray-500">
                        {collector.assignedCustomers} customers assigned
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${collector.totalCollected.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">
                        {collector.collectionRate.toFixed(1)}% collection rate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Package Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Basic', 'Standard', 'Premium'].map((packageType) => {
                  const packageCustomers = customers.filter(c => c.package === packageType);
                  const packageRevenue = packageCustomers.reduce((sum, c) => sum + c.monthlyFee, 0);
                  return (
                    <div key={packageType} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{packageType} Package</div>
                        <div className="text-sm text-gray-500">
                          {packageCustomers.length} customers
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${packageRevenue.toFixed(2)}/month</div>
                        <div className="text-sm text-gray-500">
                          Avg: ${packageCustomers.length > 0 ? (packageRevenue / packageCustomers.length).toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}