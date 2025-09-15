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
import { Calendar, DollarSign, FileText, Plus, Search } from 'lucide-react';
import { useData, Bill } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';

export default function BillingPage() {
  const { customers, bills, collectors, generateBills, updateBillStatus } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const filteredBills = bills.filter(bill => {
    const customer = customers.find(c => c.id === bill.customerId);
    const matchesSearch = customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer?.phone.includes(searchTerm) ||
                         bill.id.includes(searchTerm);
    const matchesStatus = selectedStatus === 'all' || bill.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalBills = bills.length;
  const paidBills = bills.filter(b => b.status === 'paid').length;
  const unpaidBills = bills.filter(b => b.status === 'unpaid').length;
  const overdueBills = bills.filter(b => b.status === 'overdue').length;
  const totalRevenue = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);

  const handleGenerateBills = () => {
    generateBills();
    setIsGenerateDialogOpen(false);
  };

  const handleUpdateBillStatus = (bill: Bill, newStatus: 'paid' | 'unpaid' | 'overdue') => {
    const paymentData = newStatus === 'paid' ? {
      customerId: bill.customerId,
      amount: bill.amount,
      paidDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      collectorId: bill.collectorId
    } : undefined;
    
    updateBillStatus(bill.id, newStatus, paymentData);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
            <p className="text-gray-600">Manage bills and payments</p>
          </div>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Bills
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Monthly Bills</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="billMonth">Bill Month</Label>
                  <Input
                    id="billMonth"
                    type="month"
                    defaultValue={new Date().toISOString().slice(0, 7)}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    defaultValue={new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="lateFee">Late Fee (%)</Label>
                  <Input
                    id="lateFee"
                    type="number"
                    placeholder="5"
                    step="0.1"
                  />
                </div>
                <Button onClick={handleGenerateBills} className="w-full">
                  Generate Bills for All Active Customers
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBills}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paidBills}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{unpaidBills}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Calendar className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer name, phone, or bill ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bills Table */}
        <Card>
          <CardHeader>
            <CardTitle>Bills ({filteredBills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bill Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => {
                  const customer = customers.find(c => c.id === bill.customerId);
                  const collector = collectors.find(c => c.id === bill.collectorId);
                  return (
                    <TableRow key={bill.id}>
                      <TableCell className="font-mono">{bill.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer?.name}</div>
                          <div className="text-sm text-gray-500">{customer?.phone}</div>
                        </div>
                      </TableCell>
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
                      <TableCell>{collector?.name}</TableCell>
                      <TableCell>
                        <Select
                          value={bill.status}
                          onValueChange={(value) => handleUpdateBillStatus(bill, value as 'paid' | 'unpaid' | 'overdue')}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}