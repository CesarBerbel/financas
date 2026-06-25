import Link from 'next/link';
import { AuthForm } from '../../../components/auth-form';
export default function LoginPage() { return <main><h1>Entrar</h1><AuthForm mode="login" /><p><Link href="/register">Criar conta</Link></p></main>; }
