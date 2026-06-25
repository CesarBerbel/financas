import Link from 'next/link';
import { ProfileList } from '../../components/profile-list';

export default function ProfilesPage() {
  return (
    <main className="stack">
      <nav className="actions" aria-label="Navegação principal">
        <Link className="btn secondary" href="/dashboard">Dashboard</Link>
        <Link className="btn secondary" href="/accounts">Contas</Link>
        <Link className="btn secondary" href="/transactions">Transações</Link>
      </nav>
      <section>
        <h1>Perfis financeiros</h1>
        <p className="muted">Cada perfil isola contas, relatórios e futuras transações. Perfis ativos aparecem automaticamente no cadastro de contas.</p>
      </section>
      <ProfileList />
    </main>
  );
}
