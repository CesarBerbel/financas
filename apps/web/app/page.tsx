import Link from 'next/link';
export default function Home() {
  return <main><section className="card"><p className="muted">Finanças multiperfil e multimoeda</p><h1>Controle Brasil, Portugal pessoal e Portugal empresarial sem misturar patrimônios.</h1><p>Release 1 reúne autenticação, perfis, contas, transações e organização por categorias para o MVP operacional.</p><div style={{display:'flex', gap:12, flexWrap:'wrap'}}><Link className="btn" href="/register">Criar conta</Link><Link className="btn secondary" href="/login">Entrar</Link></div></section></main>;
}
