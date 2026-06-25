import Link from 'next/link';
import { ProfileList } from '../../components/profile-list';

export default function ProfilesPage() {
  return (
    <main className="stack">
      <p><Link className="btn secondary" href="/dashboard">Voltar ao dashboard</Link></p>
      <section>
        <h1>Perfis financeiros</h1>
        <p className="muted">Cada perfil isola contas, relatórios e futuras transações. Perfis ativos aparecem automaticamente no cadastro de contas.</p>
      </section>
      <ProfileList />
    </main>
  );
}
