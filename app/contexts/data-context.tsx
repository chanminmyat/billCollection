'use client';

import React, { createContext, useContext, useState } from 'react';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  package: string;
  monthlyFee: number;
  status: 'active' | 'inactive';
  collectorId: string;
  joinDate: string;
}

export interface Bill {
  id: string;
  customerId: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'unpaid' | 'overdue';
  billMonth: string;
  paidDate?: string;
  paymentMethod?: 'cash' | 'transfer' | 'online';
  collectorId: string;
}

export interface Collector {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
}

export interface Payment {
  id: string;
  billId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'transfer' | 'online';
  collectorId: string;
  receiptNumber: string;
}

interface DataContextType {
  customers: Customer[];
  bills: Bill[];
  collectors: Collector[];
  payments: Payment[];
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCollector: (collector: Omit<Collector, 'id'>) => void;
  updateCollector: (id: string, collector: Partial<Collector>) => void;
  deleteCollector: (id: string) => void;
  updateBillStatus: (billId: string, status: 'paid' | 'unpaid' | 'overdue', paymentData?: any) => void;
  generateBills: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [customers] = useState<Customer[]>([
    {
      id: '1',
      name: 'John Smith',
      phone: '+1-555-0101',
      address: '123 Main St, City, State 12345',
      package: 'Premium',
      monthlyFee: 49.99,
      status: 'active',
      collectorId: '1',
      joinDate: '2023-01-15'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      phone: '+1-555-0102',
      address: '456 Oak Ave, City, State 12345',
      package: 'Basic',
      monthlyFee: 29.99,
      status: 'active',
      collectorId: '1',
      joinDate: '2023-02-20'
    },
    {
      id: '3',
      name: 'Michael Brown',
      phone: '+1-555-0103',
      address: '789 Pine St, City, State 12345',
      package: 'Premium',
      monthlyFee: 49.99,
      status: 'active',
      collectorId: '2',
      joinDate: '2023-01-10'
    },
    {
      id: '4',
      name: 'Emily Davis',
      phone: '+1-555-0104',
      address: '321 Elm St, City, State 12345',
      package: 'Standard',
      monthlyFee: 39.99,
      status: 'active',
      collectorId: '2',
      joinDate: '2023-03-05'
    },
    {
      id: '5',
      name: 'David Wilson',
      phone: '+1-555-0105',
      address: '654 Maple Ave, City, State 12345',
      package: 'Basic',
      monthlyFee: 29.99,
      status: 'inactive',
      collectorId: '1',
      joinDate: '2022-12-15'
    }
  ]);

  const [bills, setBills] = useState<Bill[]>([
    {
      id: '1',
      customerId: '1',
      amount: 49.99,
      dueDate: '2024-01-15',
      status: 'paid',
      billMonth: 'January 2024',
      paidDate: '2024-01-10',
      paymentMethod: 'cash',
      collectorId: '1'
    },
    {
      id: '2',
      customerId: '2',
      amount: 29.99,
      dueDate: '2024-01-15',
      status: 'unpaid',
      billMonth: 'January 2024',
      collectorId: '1'
    },
    {
      id: '3',
      customerId: '3',
      amount: 49.99,
      dueDate: '2024-01-15',
      status: 'overdue',
      billMonth: 'January 2024',
      collectorId: '2'
    },
    {
      id: '4',
      customerId: '4',
      amount: 39.99,
      dueDate: '2024-01-15',
      status: 'paid',
      billMonth: 'January 2024',
      paidDate: '2024-01-12',
      paymentMethod: 'transfer',
      collectorId: '2'
    },
    {
      id: '5',
      customerId: '1',
      amount: 49.99,
      dueDate: '2024-02-15',
      status: 'unpaid',
      billMonth: 'February 2024',
      collectorId: '1'
    },
    {
      id: '6',
      customerId: '2',
      amount: 29.99,
      dueDate: '2024-02-15',
      status: 'unpaid',
      billMonth: 'February 2024',
      collectorId: '1'
    }
  ]);

  const [collectors] = useState<Collector[]>([
    {
      id: '1',
      name: 'John Collector',
      phone: '+1-555-0201',
      email: 'john.collector@billflow.com',
      area: 'Downtown'
    },
    {
      id: '2',
      name: 'Mary Collector',
      phone: '+1-555-0202',
      email: 'mary.collector@billflow.com',
      area: 'Uptown'
    }
  ]);

  const [payments, setPayments] = useState<Payment[]>([
    {
      id: '1',
      billId: '1',
      customerId: '1',
      amount: 49.99,
      paymentDate: '2024-01-10',
      paymentMethod: 'cash',
      collectorId: '1',
      receiptNumber: 'RCP001'
    },
    {
      id: '2',
      billId: '4',
      customerId: '4',
      amount: 39.99,
      paymentDate: '2024-01-12',
      paymentMethod: 'transfer',
      collectorId: '2',
      receiptNumber: 'RCP002'
    }
  ]);

  const addCustomer = (customer: Omit<Customer, 'id'>) => {
    // This would normally make an API call
    console.log('Adding customer:', customer);
  };

  const updateCustomer = (id: string, customer: Partial<Customer>) => {
    // This would normally make an API call
    console.log('Updating customer:', id, customer);
  };

  const deleteCustomer = (id: string) => {
    // This would normally make an API call
    console.log('Deleting customer:', id);
  };

  const addCollector = (collector: Omit<Collector, 'id'>) => {
    // This would normally make an API call
    console.log('Adding collector:', collector);
  };

  const updateCollector = (id: string, collector: Partial<Collector>) => {
    // This would normally make an API call
    console.log('Updating collector:', id, collector);
  };

  const deleteCollector = (id: string) => {
    // This would normally make an API call
    console.log('Deleting collector:', id);
  };

  const updateBillStatus = (billId: string, status: 'paid' | 'unpaid' | 'overdue', paymentData?: any) => {
    setBills(prevBills => 
      prevBills.map(bill => 
        bill.id === billId 
          ? { 
              ...bill, 
              status, 
              ...(status === 'paid' && paymentData ? {
                paidDate: paymentData.paidDate,
                paymentMethod: paymentData.paymentMethod
              } : {})
            }
          : bill
      )
    );

    if (status === 'paid' && paymentData) {
      const newPayment: Payment = {
        id: Date.now().toString(),
        billId,
        customerId: paymentData.customerId,
        amount: paymentData.amount,
        paymentDate: paymentData.paidDate,
        paymentMethod: paymentData.paymentMethod,
        collectorId: paymentData.collectorId,
        receiptNumber: `RCP${Date.now()}`
      };
      setPayments(prev => [...prev, newPayment]);
    }
  };

  const generateBills = () => {
    console.log('Generating bills for all customers');
  };

  return (
    <DataContext.Provider value={{
      customers,
      bills,
      collectors,
      payments,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addCollector,
      updateCollector,
      deleteCollector,
      updateBillStatus,
      generateBills
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}