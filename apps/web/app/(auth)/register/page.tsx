import Link from 'next/link';
import { AuthForm } from '../../../components/auth-form';
export default function RegisterPage() { return <main><h1>Criar conta</h1><p className="muted">Ao registrar, o sistema cria automaticamente os perfis Brasil, Portugal pessoal e Empresa Portugal.</p><AuthForm mode="register" /><p><Link href="/login">Já tenho conta</Link></p></main>; }
