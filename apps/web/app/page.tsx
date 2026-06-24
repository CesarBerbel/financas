import Link from 'next/link';
export default function Home() {
  return <main><section className="card"><p className="muted">Finanças multiperfil e multimoeda</p><h1>Controle Brasil, Portugal pessoal e Portugal empresarial sem misturar patrimônios.</h1><p>Fase 0 entrega autenticação, perfis financeiros, moedas BRL/EUR, sessão preparada e auditoria básica.</p><div style={{display:'flex', gap:12, flexWrap:'wrap'}}><Link className="btn" href="/register">Criar conta</Link><Link className="btn secondary" href="/login">Entrar</Link></div></section></main>;
}
