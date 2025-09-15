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
import { Search, Plus, Edit, Trash2, Phone, MapPin } from 'lucide-react';
import { useData, Customer } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';

export default function CustomersPage() {
  const { customers, collectors, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    address: string;
    package: string;
    monthlyFee: number;
    status: 'active' | 'inactive';
    collectorId: string;
    joinDate: string;
  }>({
    name: '',
    phone: '',
    address: '',
    package: '',
    monthlyFee: 0,
    status: 'active',
    collectorId: '',
    joinDate: new Date().toISOString().split('T')[0]
  });

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         customer.id.includes(searchTerm);
    const matchesStatus = selectedStatus === 'all' || customer.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddCustomer = () => {
    addCustomer(newCustomer);
    setIsAddDialogOpen(false);
    setNewCustomer({
      name: '',
      phone: '',
      address: '',
      package: '',
      monthlyFee: 0,
      status: 'active',
      collectorId: '',
      joinDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      package: customer.package,
      monthlyFee: customer.monthlyFee,
      status: customer.status,
      collectorId: customer.collectorId,
      joinDate: customer.joinDate
    });
  };

  const handleUpdateCustomer = () => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, newCustomer);
      setEditingCustomer(null);
      setNewCustomer({
        name: '',
        phone: '',
        address: '',
        package: '',
        monthlyFee: 0,
        status: 'active',
        collectorId: '',
        joinDate: new Date().toISOString().split('T')[0]
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-600">Manage your customer database</p>
          </div>
          <Dialog open={isAddDialogOpen || !!editingCustomer} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) setEditingCustomer(null);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="package">Package</Label>
                  <Select value={newCustomer.package} onValueChange={(value) => setNewCustomer({ ...newCustomer, package: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="monthlyFee">Monthly Fee</Label>
                  <Input
                    id="monthlyFee"
                    type="number"
                    value={newCustomer.monthlyFee}
                    onChange={(e) => setNewCustomer({ ...newCustomer, monthlyFee: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="collector">Assigned Collector</Label>
                  <Select value={newCustomer.collectorId} onValueChange={(value) => setNewCustomer({ ...newCustomer, collectorId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select collector" />
                    </SelectTrigger>
                    <SelectContent>
                      {collectors.map((collector) => (
                        <SelectItem key={collector.id} value={collector.id}>
                          {collector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={newCustomer.status} onValueChange={(value) => setNewCustomer({ ...newCustomer, status: value as 'active' | 'inactive' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
                  className="w-full"
                >
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, or ID..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const collector = collectors.find(c => c.id === customer.collectorId);
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-500">ID: {customer.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1" />
                            {customer.phone}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="h-3 w-3 mr-1" />
                            {customer.address.substring(0, 30)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{customer.package}</TableCell>
                      <TableCell>${customer.monthlyFee}</TableCell>
                      <TableCell>{collector?.name || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteCustomer(customer.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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