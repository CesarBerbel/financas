import Link from 'next/link';
import { AccountManager } from '../../components/accounts/account-manager';

export default function AccountsPage() {
  return (
    <main className="stack">
      <nav className="actions" aria-label="Navegação principal">
        <Link className="btn secondary" href="/dashboard">Dashboard</Link>
        <Link className="btn secondary" href="/profiles">Perfis</Link>
        <Link className="btn secondary" href="/transactions">Transações</Link>
      </nav>
      <AccountManager />
    </main>
  );
}
