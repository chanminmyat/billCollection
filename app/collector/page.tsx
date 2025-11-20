'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, FileText, Users, Calendar, Receipt, Eye, Phone, MapPin, CreditCard } from 'lucide-react';
import { useData } from '../contexts/data-context';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';

export default function CollectorDashboard() {
  const { customers, bills, updateBillStatus } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBillDetails, setSelectedBillDetails] = useState<any>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any>(null);

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
            <div className="space-y-4">
              {dueBills.map((bill) => {
                const customer = customers.find(c => c.id === bill.customerId);
                return (
                  <div key={bill.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-lg">{customer?.name}</h3>
                        <p className="text-sm text-gray-500">Bill Month: {bill.billMonth}</p>
                      </div>
                      <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {bill.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-green-600">
                        ${bill.amount}
                      </div>
                      <div className="text-sm text-gray-500">
                        Due: {bill.dueDate}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedBillDetails({ ...bill, customer })}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCollectPayment({ ...bill, customer })}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Collect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Assigned Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCustomers.map((customer) => {
                const lastBill = myBills
                  .filter(b => b.customerId === customer.id)
                  .sort((a, b) => new Date(b.billMonth).getTime() - new Date(a.billMonth).getTime())[0];
                
                return (
                  <div key={customer.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-lg">{customer.name}</h3>
                        <p className="text-sm text-gray-500">{customer.package} Package</p>
                      </div>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">
                        ${customer.monthlyFee}/month
                      </div>
                      <div className="text-sm text-gray-500">
                        Last Payment: {lastBill?.paidDate || 'None'}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedCustomerDetails({ ...customer, lastBill })}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                );
              })}
            </div>
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

        {/* Bill Details Dialog */}
        <Dialog open={!!selectedBillDetails} onOpenChange={(open) => !open && setSelectedBillDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bill Details</DialogTitle>
            </DialogHeader>
            {selectedBillDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">{selectedBillDetails.customer?.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Bill ID</Label>
                    <p className="font-mono text-sm">{selectedBillDetails.id}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Bill Month</Label>
                    <p>{selectedBillDetails.billMonth}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Due Date</Label>
                    <p>{selectedBillDetails.dueDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Amount</Label>
                    <p className="text-2xl font-bold text-green-600">${selectedBillDetails.amount}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge variant={selectedBillDetails.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {selectedBillDetails.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Customer Contact</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedBillDetails.customer?.phone}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="flex items-start space-x-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className="text-sm">{selectedBillDetails.customer?.address}</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    handleCollectPayment(selectedBillDetails);
                    setSelectedBillDetails(null);
                  }}
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Collect Payment
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Customer Details Dialog */}
        <Dialog open={!!selectedCustomerDetails} onOpenChange={(open) => !open && setSelectedCustomerDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
            </DialogHeader>
            {selectedCustomerDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">{selectedCustomerDetails.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer ID</Label>
                    <p className="font-mono text-sm">{selectedCustomerDetails.id}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Package</Label>
                    <p>{selectedCustomerDetails.package}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Monthly Fee</Label>
                    <p className="text-lg font-bold">${selectedCustomerDetails.monthlyFee}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge variant={selectedCustomerDetails.status === 'active' ? 'default' : 'secondary'}>
                      {selectedCustomerDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Join Date</Label>
                    <p>{selectedCustomerDetails.joinDate}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedCustomerDetails.phone}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="flex items-start space-x-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className="text-sm">{selectedCustomerDetails.address}</span>
                  </div>
                </div>

                {selectedCustomerDetails.lastBill && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Last Payment</Label>
                    <p className="text-sm">
                      {selectedCustomerDetails.lastBill.paidDate || 'No payment yet'} 
                      {selectedCustomerDetails.lastBill.paidDate && ` - $${selectedCustomerDetails.lastBill.amount}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}