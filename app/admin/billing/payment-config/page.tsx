import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/admin/billing/payment-config/create');
}

