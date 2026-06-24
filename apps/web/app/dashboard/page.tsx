import Link from 'next/link';
import { ProfileList } from '../../components/profile-list';
export default function DashboardPage() { return <main><h1>Dashboard inicial</h1><p className="muted">Fase 0: seleção e isolamento de perfis financeiros. Saldos entram na Fase 1.</p><ProfileList /><p><Link className="btn secondary" href="/profiles">Gerenciar perfis</Link></p></main>; }
