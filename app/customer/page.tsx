'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, DollarSign, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { useData } from '../contexts/data-context';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';

export default function CustomerDashboard() {
  const { customers, bills, payments } = useData();
  const { user } = useAuth();

  if (!user || user.role !== 'customer') {
    return <div>Access denied</div>;
  }

  // Get customer data
  const customer = customers.find(c => c.id === user.id) || customers[0]; // Fallback for demo
  const customerBills = bills.filter(b => b.customerId === customer.id);
  const customerPayments = payments.filter(p => p.customerId === customer.id);

  // Stats
  const totalBills = customerBills.length;
  const paidBills = customerBills.filter(b => b.status === 'paid').length;
  const unpaidBills = customerBills.filter(b => b.status === 'unpaid').length;
  const overdueBills = customerBills.filter(b => b.status === 'overdue').length;
  const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = customerBills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + b.amount, 0);

  const handleDownloadReceipt = (payment: any) => {
    console.log('Downloading receipt for payment:', payment);
    alert(`Receipt downloaded: ${payment.receiptNumber}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-gray-600">Welcome, {customer.name}</p>
        </div>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Customer ID</Label>
                <p className="font-mono">{customer.id}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Package</Label>
                <p className="font-medium">{customer.package}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Monthly Fee</Label>
                <p className="font-bold">${customer.monthlyFee}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                  {customer.status}
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-sm text-gray-500">Address</Label>
              <p>{customer.address}</p>
            </div>
            <div className="mt-2">
              <Label className="text-sm text-gray-500">Phone</Label>
              <p>{customer.phone}</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBills}</div>
              <p className="text-xs text-muted-foreground">
                All time bills generated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {paidBills} bills paid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">${totalOutstanding.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {unpaidBills} unpaid bills
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">
                Bills past due date
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bills */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Bill Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerBills.slice(0, 10).map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono">{bill.id}</TableCell>
                    <TableCell>{bill.billMonth}</TableCell>
                    <TableCell>${bill.amount}</TableCell>
                    <TableCell>{bill.dueDate}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          bill.status === 'paid' ? 'default' :
                          bill.status === 'unpaid' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{bill.paidDate || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono">{payment.receiptNumber}</TableCell>
                    <TableCell>{payment.paymentDate}</TableCell>
                    <TableCell>${payment.amount}</TableCell>
                    <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadReceipt(payment)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}