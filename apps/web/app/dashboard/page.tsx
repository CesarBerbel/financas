import Link from 'next/link';
import { AccountSummary } from '../../components/accounts/account-summary';
import { ProfileList } from '../../components/profile-list';

export default function DashboardPage() {
  return (
    <main className="stack">
      <section>
        <h1>Dashboard inicial</h1>
        <p className="muted">Fase 1: saldos por conta, perfil e moeda, mantendo isolamento entre perfis financeiros.</p>
        <p><Link className="btn" href="/accounts">Cadastrar conta</Link> <Link className="btn secondary" href="/profiles">Gerenciar perfis</Link></p>
      </section>
      <AccountSummary />
      <section className="stack">
        <h2>Perfis financeiros</h2>
        <ProfileList />
      </section>
    </main>
  );
}
