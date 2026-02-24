'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  DollarSign,
  FileText,
  Users,
  Calendar,
  Eye,
  Phone,
  MapPin,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';

type CollectorCustomer = {
  id: string;
  customerCode?: string;
  personalName?: string | null;
  companyName?: string | null;
  primaryPhone?: string | null;
  installationAddress?: string | null;
  status?: string | null;
  collectorCode?: string | null;
  collectorId?: string | null;
  collector?: {
    id?: string | null;
    collectorCode?: string | null;
  } | null;
  subscription?: {
    plan?: {
      planName?: string | null;
      planCode?: string | null;
      monthlyFee?: string | number | null;
      currency?: string | null;
    } | null;
  } | null;
};

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  status: InvoiceStatus;
  totalAmount?: string | number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  receiptNo?: string | null;
  customer?: {
    id?: string | null;
    customerCode?: string | null;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
  } | null;
};

const normalizeKey = (value?: string | null) => (value ? value.trim().toLowerCase() : '');

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

const getCustomerDisplayName = (customer: {
  personalName?: string | null;
  companyName?: string | null;
}) => customer.personalName || customer.companyName || 'Unknown Customer';

const getInvoicePeriodLabel = (invoice: InvoiceRecord) => {
  if (invoice.billingPeriodFrom && invoice.billingPeriodTo) {
    return `${invoice.billingPeriodFrom} - ${invoice.billingPeriodTo}`;
  }
  return invoice.invoiceNo || invoice.id;
};

const getCustomerInvoiceDate = (invoice: InvoiceRecord) => {
  const candidate = invoice.invoiceDate || invoice.dueDate || invoice.paidAt;
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function CollectorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedPayment, setSelectedPayment] = useState<InvoiceRecord | null>(null);
  const [selectedBillDetails, setSelectedBillDetails] = useState<InvoiceRecord | null>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<{
    customer: CollectorCustomer;
    lastInvoice?: InvoiceRecord;
  } | null>(null);

  const [customers, setCustomers] = useState<CollectorCustomer[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  const collectorIdentityKeys = useMemo(() => {
    const keys = new Set<string>();
    const add = (value?: string | null) => {
      const key = normalizeKey(value);
      if (key) keys.add(key);
    };

    add(user?.id);
    add(user?.username);
    add(user?.collectorProfile?.id);
    add(user?.collectorProfile?.collectorCode);

    return keys;
  }, [user?.id, user?.username, user?.collectorProfile?.id, user?.collectorProfile?.collectorCode]);

  useEffect(() => {
    if (!user || user.role !== 'collector') {
      return;
    }

    let mounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [customersResponse, invoicesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/customers`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }),
          fetch(`${API_BASE_URL}/billing/invoices`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
        ]);

        if (!customersResponse.ok) {
          const data = await customersResponse.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load customers');
        }

        if (!invoicesResponse.ok) {
          const data = await invoicesResponse.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load invoices');
        }

        const customersData = await customersResponse.json().catch(() => []);
        const invoicesData = await invoicesResponse.json().catch(() => []);

        const customerList = Array.isArray(customersData)
          ? customersData
          : Array.isArray(customersData?.customers)
            ? customersData.customers
            : [];
        const invoiceList = Array.isArray(invoicesData)
          ? invoicesData
          : Array.isArray(invoicesData?.invoices)
            ? invoicesData.invoices
            : [];

        if (!mounted) return;

        setCustomers(customerList);
        setInvoices(invoiceList);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard data');
        setCustomers([]);
        setInvoices([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role]);

  if (!user || user.role !== 'collector') {
    return <div>Access denied</div>;
  }

  const customerBelongsToCollector = (customer: CollectorCustomer) => {
    const assignmentKeys = [
      customer.collectorCode,
      customer.collectorId,
      customer.collector?.id,
      customer.collector?.collectorCode
    ]
      .map((value) => normalizeKey(value))
      .filter(Boolean);

    if (assignmentKeys.length === 0) return false;
    return assignmentKeys.some((key) => collectorIdentityKeys.has(key));
  };

  const myCustomers = customers.filter(customerBelongsToCollector);
  const myCustomerIdKeys = new Set(myCustomers.map((customer) => normalizeKey(customer.id)).filter(Boolean));
  const myCustomerCodeKeys = new Set(
    myCustomers.map((customer) => normalizeKey(customer.customerCode)).filter(Boolean)
  );

  const invoiceBelongsToCollector = (invoice: InvoiceRecord) => {
    const invoiceCustomerId = normalizeKey(invoice.customer?.id);
    const invoiceCustomerCode = normalizeKey(invoice.customer?.customerCode);
    return (
      (invoiceCustomerId && myCustomerIdKeys.has(invoiceCustomerId)) ||
      (invoiceCustomerCode && myCustomerCodeKeys.has(invoiceCustomerCode))
    );
  };

  const myInvoices = invoices.filter(invoiceBelongsToCollector);
  const dueBills = myInvoices.filter((bill) => bill.status === 'unpaid' || bill.status === 'overdue');

  const filteredCustomers = myCustomers.filter((customer) => {
    const name = getCustomerDisplayName(customer).toLowerCase();
    const phone = customer.primaryPhone?.toLowerCase() || '';
    const code = customer.customerCode?.toLowerCase() || '';
    const query = searchTerm.toLowerCase();
    return name.includes(query) || phone.includes(query) || code.includes(query);
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const totalAssigned = myCustomers.length;
  const todayCollection = myInvoices
    .filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 10) === todayIso)
    .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);
  const pendingBills = dueBills.length;
  const overdueBills = myInvoices.filter((bill) => bill.status === 'overdue').length;

  const findCustomerForInvoice = (invoice: InvoiceRecord) => {
    const invoiceCustomerId = normalizeKey(invoice.customer?.id);
    const invoiceCustomerCode = normalizeKey(invoice.customer?.customerCode);
    return myCustomers.find((customer) => {
      const customerId = normalizeKey(customer.id);
      const customerCode = normalizeKey(customer.customerCode);
      return (
        (invoiceCustomerId && customerId === invoiceCustomerId) ||
        (invoiceCustomerCode && customerCode === invoiceCustomerCode)
      );
    });
  };

  const handleCollectPayment = (bill: InvoiceRecord) => {
    setSelectedPayment(bill);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPayment || isCollecting) return;

    setIsCollecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${selectedPayment.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: paymentMethod.trim() || 'cash'
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to collect payment');
      }

      const updated = (await response.json()) as InvoiceRecord;
      setInvoices((prev) => prev.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
      setSelectedPayment(null);
      setPaymentMethod('cash');
      toast({
        title: 'Payment collected',
        description: 'Invoice marked as paid.'
      });
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to collect payment',
        variant: 'destructive'
      });
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Collector Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-slate-600">Loading invoices and customers...</CardContent>
          </Card>
        )}
        {!!loadError && (
          <Card>
            <CardContent className="pt-6 text-sm text-rose-600">{loadError}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">Total customers assigned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(todayCollection)}</div>
              <p className="text-xs text-muted-foreground">Collected today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBills}</div>
              <p className="text-xs text-muted-foreground">Bills to collect</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers by name, phone, or code..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Due Bills ({dueBills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {dueBills.length === 0 ? (
              <p className="text-sm text-slate-500">No unpaid invoices for your assigned customers.</p>
            ) : (
              <div className="space-y-4">
                {dueBills.map((bill) => {
                  const linkedCustomer = findCustomerForInvoice(bill);
                  const displayName = linkedCustomer
                    ? getCustomerDisplayName(linkedCustomer)
                    : getCustomerDisplayName({
                        personalName: bill.customer?.personalName,
                        companyName: bill.customer?.companyName
                      });

                  return (
                    <div key={bill.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium">{displayName}</h3>
                          <p className="text-sm text-gray-500">Invoice: {getInvoicePeriodLabel(bill)}</p>
                        </div>
                        <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                          {bill.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-green-600">
                          {formatMoney(bill.totalAmount, bill.currency || 'MMK')}
                        </div>
                        <div className="text-sm text-gray-500">Due: {bill.dueDate || '-'}</div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedBillDetails(bill)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Details
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => handleCollectPayment(bill)}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Collect
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No customers assigned.</p>
            ) : (
              <div className="space-y-4">
                {filteredCustomers.map((customer) => {
                  const customerInvoices = myInvoices
                    .filter((invoice) => {
                      const invoiceCustomerId = normalizeKey(invoice.customer?.id);
                      const invoiceCustomerCode = normalizeKey(invoice.customer?.customerCode);
                      const customerId = normalizeKey(customer.id);
                      const customerCode = normalizeKey(customer.customerCode);
                      return (
                        (invoiceCustomerId && invoiceCustomerId === customerId) ||
                        (invoiceCustomerCode && invoiceCustomerCode === customerCode)
                      );
                    })
                    .sort((a, b) => getCustomerInvoiceDate(b) - getCustomerInvoiceDate(a));

                  const lastInvoice = customerInvoices[0];
                  const packageName =
                    customer.subscription?.plan?.planName ||
                    customer.subscription?.plan?.planCode ||
                    'N/A';
                  const monthlyFee = customer.subscription?.plan?.monthlyFee;

                  return (
                    <div key={customer.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium">{getCustomerDisplayName(customer)}</h3>
                          <p className="text-sm text-gray-500">{packageName}</p>
                        </div>
                        <Badge variant={customer.status === 'enable' ? 'default' : 'secondary'}>
                          {customer.status || 'unknown'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold">
                          {formatMoney(monthlyFee, customer.subscription?.plan?.currency || 'MMK')}/month
                        </div>
                        <div className="text-sm text-gray-500">
                          Last Payment: {lastInvoice?.paidAt ? lastInvoice.paidAt.split('T')[0] : 'None'}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setSelectedCustomerDetails({ customer, lastInvoice })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedPayment.customer?.personalName,
                        companyName: selectedPayment.customer?.companyName
                      })}
                    </p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p>{selectedPayment.customer?.primaryPhone || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice</Label>
                    <p>{getInvoicePeriodLabel(selectedPayment)}</p>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(selectedPayment.totalAmount, selectedPayment.currency || 'MMK')}
                    </p>
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
                      <SelectItem value="KBZPay">KBZPay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handlePaymentSubmit} className="w-full" disabled={isCollecting}>
                  {isCollecting ? 'Saving...' : 'Mark as Paid'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedBillDetails} onOpenChange={(open) => !open && setSelectedBillDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
            </DialogHeader>
            {selectedBillDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedBillDetails.customer?.personalName,
                        companyName: selectedBillDetails.customer?.companyName
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Invoice ID</Label>
                    <p className="font-mono text-sm">{selectedBillDetails.invoiceNo || selectedBillDetails.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Billing Period</Label>
                    <p>{getInvoicePeriodLabel(selectedBillDetails)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Due Date</Label>
                    <p>{selectedBillDetails.dueDate || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Amount</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatMoney(selectedBillDetails.totalAmount, selectedBillDetails.currency || 'MMK')}
                    </p>
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
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedBillDetails.customer?.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedBillDetails.customer?.installationAddress || '-'}</span>
                  </div>
                </div>

                {selectedBillDetails.status !== 'paid' && (
                  <Button
                    onClick={() => {
                      handleCollectPayment(selectedBillDetails);
                      setSelectedBillDetails(null);
                    }}
                    className="w-full"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Collect Payment
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!selectedCustomerDetails}
          onOpenChange={(open) => !open && setSelectedCustomerDetails(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
            </DialogHeader>
            {selectedCustomerDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">{getCustomerDisplayName(selectedCustomerDetails.customer)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Code</Label>
                    <p className="font-mono text-sm">
                      {selectedCustomerDetails.customer.customerCode || selectedCustomerDetails.customer.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Package</Label>
                    <p>
                      {selectedCustomerDetails.customer.subscription?.plan?.planName ||
                        selectedCustomerDetails.customer.subscription?.plan?.planCode ||
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Monthly Fee</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(
                        selectedCustomerDetails.customer.subscription?.plan?.monthlyFee,
                        selectedCustomerDetails.customer.subscription?.plan?.currency || 'MMK'
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedCustomerDetails.customer.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedCustomerDetails.customer.installationAddress || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Payment</Label>
                  <p className="text-sm">
                    {selectedCustomerDetails.lastInvoice?.paidAt
                      ? `${selectedCustomerDetails.lastInvoice.paidAt.split('T')[0]} - ${formatMoney(
                          selectedCustomerDetails.lastInvoice.totalAmount,
                          selectedCustomerDetails.lastInvoice.currency || 'MMK'
                        )}`
                      : 'No payment yet'}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
