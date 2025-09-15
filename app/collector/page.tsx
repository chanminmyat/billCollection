'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, FileText, Users, Calendar, Receipt } from 'lucide-react';
import { useData } from '../contexts/data-context';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';

export default function CollectorDashboard() {
  const { customers, bills, updateBillStatus } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  if (!user || user.role !== 'collector') {
    return <div>Access denied</div>;
  }

  // Filter data for current collector
  const myCustomers = customers.filter(c => c.collectorId === user.id);
  const myBills = bills.filter(b => b.collectorId === user.id);
  const dueBills = myBills.filter(b => b.status === 'unpaid' || b.status === 'overdue');
  
  // Search functionality
  const filteredCustomers = myCustomers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         customer.id.includes(searchTerm);
    return matchesSearch;
  });

  // Stats
  const totalAssigned = myCustomers.length;
  const todayCollection = 0; // Would be calculated from today's payments
  const pendingBills = dueBills.length;
  const overdueBills = myBills.filter(b => b.status === 'overdue').length;

  const handleCollectPayment = (bill: any) => {
    const customer = customers.find(c => c.id === bill.customerId);
    setSelectedPayment({ ...bill, customer });
  };

  const handlePaymentSubmit = () => {
    if (selectedPayment) {
      const paymentData = {
        customerId: selectedPayment.customerId,
        amount: selectedPayment.amount,
        paidDate: new Date().toISOString().split('T')[0],
        paymentMethod,
        collectorId: user.id
      };
      
      updateBillStatus(selectedPayment.id, 'paid', paymentData);
      setSelectedPayment(null);
      setPaymentMethod('cash');
    }
  };

  const generateReceipt = (payment: any) => {
    console.log('Generating receipt for payment:', payment);
    alert(`Receipt generated for ${payment.customer?.name}\nAmount: $${payment.amount}\nReceipt #: RCP${Date.now()}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Collector Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">
                Total customers assigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${todayCollection.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Collected today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBills}</div>
              <p className="text-xs text-muted-foreground">
                Bills to collect
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers by name, phone, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Due Bills */}
        <Card>
          <CardHeader>
            <CardTitle>Due Bills ({dueBills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Bill Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueBills.map((bill) => {
                  const customer = customers.find(c => c.id === bill.customerId);
                  return (
                    <TableRow key={bill.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer?.name}</div>
                          <div className="text-sm text-gray-500">{customer?.address.substring(0, 30)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>{customer?.phone}</TableCell>
                      <TableCell>{bill.billMonth}</TableCell>
                      <TableCell className="font-bold">${bill.amount}</TableCell>
                      <TableCell>{bill.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                          {bill.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleCollectPayment({ ...bill, customer })}
                        >
                          Collect Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Assigned Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const lastBill = myBills
                    .filter(b => b.customerId === customer.id)
                    .sort((a, b) => new Date(b.billMonth).getTime() - new Date(a.billMonth).getTime())[0];
                  
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.address.substring(0, 30)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.package}</TableCell>
                      <TableCell>${customer.monthlyFee}</TableCell>
                      <TableCell>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lastBill?.paidDate || 'No payment yet'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Collection Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Collect Payment</DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer</Label>
                    <p className="font-medium">{selectedPayment.customer?.name}</p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p>{selectedPayment.customer?.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bill Month</Label>
                    <p>{selectedPayment.billMonth}</p>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <p className="font-bold text-lg">${selectedPayment.amount}</p>
                  </div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                      <SelectItem value="online">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handlePaymentSubmit} className="flex-1">
                    Mark as Paid
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateReceipt(selectedPayment)}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Generate Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}