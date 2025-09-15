'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin, Users } from 'lucide-react';
import { useData, Collector } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';

export default function CollectorsPage() {
  const { collectors, customers, bills, addCollector, updateCollector, deleteCollector } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [newCollector, setNewCollector] = useState({
    name: '',
    phone: '',
    email: '',
    area: ''
  });

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const filteredCollectors = collectors.filter(collector => {
    const matchesSearch = collector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.phone.includes(searchTerm) ||
                         collector.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collector.id.includes(searchTerm);
    return matchesSearch;
  });

  const handleAddCollector = () => {
    addCollector(newCollector);
    setIsAddDialogOpen(false);
    setNewCollector({
      name: '',
      phone: '',
      email: '',
      area: ''
    });
  };

  const handleEditCollector = (collector: Collector) => {
    setEditingCollector(collector);
    setNewCollector({
      name: collector.name,
      phone: collector.phone,
      email: collector.email,
      area: collector.area
    });
  };

  const handleUpdateCollector = () => {
    if (editingCollector) {
      updateCollector(editingCollector.id, newCollector);
      setEditingCollector(null);
      setNewCollector({
        name: '',
        phone: '',
        email: '',
        area: ''
      });
    }
  };

  const getCollectorStats = (collectorId: string) => {
    const assignedCustomers = customers.filter(c => c.collectorId === collectorId);
    const collectorBills = bills.filter(b => b.collectorId === collectorId);
    const paidBills = collectorBills.filter(b => b.status === 'paid');
    const totalCollected = paidBills.reduce((sum, b) => sum + b.amount, 0);
    const collectionRate = collectorBills.length > 0 ? (paidBills.length / collectorBills.length * 100) : 0;

    return {
      assignedCustomers: assignedCustomers.length,
      totalCollected,
      collectionRate,
      totalBills: collectorBills.length
    };
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collector Management</h1>
            <p className="text-gray-600">Manage your collection team</p>
          </div>
          <Dialog open={isAddDialogOpen || !!editingCollector} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) setEditingCollector(null);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Collector
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCollector ? 'Edit Collector' : 'Add New Collector'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newCollector.name}
                    onChange={(e) => setNewCollector({ ...newCollector, name: e.target.value })}
                    placeholder="Enter collector's full name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={newCollector.phone}
                    onChange={(e) => setNewCollector({ ...newCollector, phone: e.target.value })}
                    placeholder="+1-555-0123"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCollector.email}
                    onChange={(e) => setNewCollector({ ...newCollector, email: e.target.value })}
                    placeholder="collector@billflow.com"
                  />
                </div>
                <div>
                  <Label htmlFor="area">Assigned Area</Label>
                  <Input
                    id="area"
                    value={newCollector.area}
                    onChange={(e) => setNewCollector({ ...newCollector, area: e.target.value })}
                    placeholder="Downtown, Uptown, etc."
                  />
                </div>
                <Button
                  onClick={editingCollector ? handleUpdateCollector : handleAddCollector}
                  className="w-full"
                >
                  {editingCollector ? 'Update Collector' : 'Add Collector'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collectors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collectors.length}</div>
              <p className="text-xs text-muted-foreground">
                Active collection team
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Customers/Collector</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {collectors.length > 0 ? Math.round(customers.length / collectors.length) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Customer distribution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {collectors.length > 0 ? collectors[0].name.split(' ')[0] : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Highest collection rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Areas Covered</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(collectors.map(c => c.area)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Geographic coverage
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
                placeholder="Search by name, phone, email, area, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Collectors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Collectors ({filteredCollectors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collector</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Assigned Area</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Total Collected</TableHead>
                  <TableHead>Collection Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCollectors.map((collector) => {
                  const stats = getCollectorStats(collector.id);
                  return (
                    <TableRow key={collector.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{collector.name}</div>
                          <div className="text-sm text-gray-500">ID: {collector.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1" />
                            {collector.phone}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="h-3 w-3 mr-1" />
                            {collector.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          {collector.area}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Users className="h-3 w-3 mr-1 text-gray-400" />
                          {stats.assignedCustomers}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${stats.totalCollected.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">{stats.totalBills} bills</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium">
                            {stats.collectionRate.toFixed(1)}%
                          </div>
                          <Badge 
                            variant={
                              stats.collectionRate >= 80 ? 'default' :
                              stats.collectionRate >= 60 ? 'secondary' :
                              'destructive'
                            }
                          >
                            {stats.collectionRate >= 80 ? 'Excellent' :
                             stats.collectionRate >= 60 ? 'Good' :
                             'Needs Improvement'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCollector(collector)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteCollector(collector.id)}
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

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collectors.map((collector) => {
                const stats = getCollectorStats(collector.id);
                return (
                  <div key={collector.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{collector.name}</h3>
                      <Badge 
                        variant={
                          stats.collectionRate >= 80 ? 'default' :
                          stats.collectionRate >= 60 ? 'secondary' :
                          'destructive'
                        }
                      >
                        {stats.collectionRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Area:</span>
                        <span>{collector.area}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Customers:</span>
                        <span>{stats.assignedCustomers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Collected:</span>
                        <span className="font-medium">${stats.totalCollected.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}