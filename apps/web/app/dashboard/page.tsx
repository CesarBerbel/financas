import Link from 'next/link';
import { AccountSummary } from '../../components/accounts/account-summary';

export default function DashboardPage() {
  return (
    <main className="stack">
      <section className="page-header">
        <div>
          <h1>Dashboard inicial</h1>
          <p className="muted">Resumo operacional com quantidade de contas, saldo consolidado e atalhos principais.</p>
        </div>
      </section>

      <AccountSummary />

      <section className="grid" aria-label="Atalhos de gestão financeira">
        <Link className="card nav-card" href="/accounts">
          <span className="nav-card-title">Contas</span>
          <span className="muted">Listar, adicionar, editar, arquivar e fechar contas financeiras.</span>
        </Link>
        <Link className="card nav-card" href="/profiles">
          <span className="nav-card-title">Perfis</span>
          <span className="muted">Listar, adicionar, editar e arquivar perfis financeiros.</span>
        </Link>
        <Link className="card nav-card" href="/transactions">
          <span className="nav-card-title">Transações</span>
          <span className="muted">Registrar receitas, despesas, transferências e ajustes de saldo.</span>
        </Link>
      </section>
    </main>
  );
}
