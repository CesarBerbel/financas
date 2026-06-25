import Link from 'next/link';
import { CategoryManager } from '../../components/categories/category-manager';

export default function CategoriesPage() {
  return (
    <main className="stack">
      <nav className="actions" aria-label="Navegação principal">
        <Link className="btn secondary small" href="/dashboard">Dashboard</Link>
        <Link className="btn secondary small" href="/transactions">Transações</Link>
        <Link className="btn secondary small" href="/accounts">Contas</Link>
        <Link className="btn secondary small" href="/profiles">Perfis</Link>
      </nav>
      <CategoryManager />
    </main>
  );
}
