import { redirect } from 'next/navigation';

// Deposit flow is handled by the modal on the landing page.
// This route just redirects home.
export default function DepositPage() {
  redirect('/');
}
