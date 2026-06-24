'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const payload = Object.fromEntries(formData.entries());
      const result = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!result?.accessToken) {
        throw new Error('Token de acesso não retornado pela API.');
      }

      localStorage.setItem('financas_token', result.accessToken);
      setSuccess('Login realizado com sucesso. Redirecionando para o dashboard...');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Não foi possível autenticar. Verifique os dados e tente novamente.');
      setIsSubmitting(false);
    }
  }

  return (
    <form action={submit} className="card" aria-describedby="form-status">
      {mode === 'register' && (
        <label>
          Nome
          <input name="name" minLength={2} required disabled={isSubmitting} />
        </label>
      )}

      <label>
        E-mail
        <input name="email" type="email" required disabled={isSubmitting} />
      </label>

      <label>
        Senha
        <input name="password" type="password" minLength={8} required disabled={isSubmitting} />
      </label>

      <button className="btn" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando...' : mode === 'register' ? 'Criar conta' : 'Entrar'}
      </button>

      <div id="form-status" aria-live="polite">
        {error && <p className="alert">{error}</p>}
        {success && <p className="alert success">{success}</p>}
      </div>
    </form>
  );
}
