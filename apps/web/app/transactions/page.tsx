import Link from 'next/link';
import { TransactionManager } from '../../components/transactions/transaction-manager';

export default function TransactionsPage() {
  return (
    <main className="stack">
      <nav className="actions" aria-label="Navegação principal">
        <Link className="btn secondary small" href="/dashboard">Dashboard</Link>
        <Link className="btn secondary small" href="/categories">Categorias</Link>
        <Link className="btn secondary small" href="/accounts">Contas</Link>
        <Link className="btn secondary small" href="/profiles">Perfis</Link>
      </nav>
      <TransactionManager />
    </main>
  );
}
