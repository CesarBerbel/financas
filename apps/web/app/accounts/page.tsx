import Link from 'next/link';
import { AccountManager } from '../../components/accounts/account-manager';

export default function AccountsPage() {
  return (
    <main>
      <p><Link className="btn secondary" href="/dashboard">Voltar ao dashboard</Link></p>
      <AccountManager />
    </main>
  );
}
