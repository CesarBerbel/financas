'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../../lib/api';

type Profile = { id: string; name: string; type: string; baseCurrency: string; status: string };
type Account = {
  id: string;
  financialProfileId: string;
  name: string;
  type: string;
  currencyCode: string;
  initialBalance: string;
  currentBalance: string;
  reconciledBalance: string;
  projectedBalance: string;
  status: string;
  description?: string | null;
  financialProfile?: { id: string; name: string; type: string };
};

const accountTypes = [
  { value: 'CHECKING', label: 'Conta corrente' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'WALLET', label: 'Carteira' },
  { value: 'INVESTMENT', label: 'Investimento' },
  { value: 'BUSINESS', label: 'Empresarial' },
  { value: 'RESERVE', label: 'Reserva' },
];

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
}

export function AccountManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedProfileId), [profiles, selectedProfileId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [profileResult, accountResult] = await Promise.all([authApi('/financial-profiles'), authApi('/accounts')]);
      setProfiles(profileResult);
      setAccounts(accountResult);
      setSelectedProfileId((current) => current || profileResult[0]?.id || '');
    } catch {
      setError('Não foi possível carregar contas. Entre novamente e tente outra vez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await authApi('/accounts', { method: 'POST', body: JSON.stringify(payload) });
      setSuccess('Conta criada com sucesso.');
      form.reset();
      await loadData();
    } catch {
      setError('Não foi possível criar a conta. Verifique os campos e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeStatus(accountId: string, action: 'archive' | 'close') {
    setError('');
    setSuccess('');
    try {
      await authApi(`/accounts/${accountId}/${action}`, { method: 'POST' });
      setSuccess(action === 'archive' ? 'Conta arquivada.' : 'Conta fechada.');
      await loadData();
    } catch {
      setError('Não foi possível alterar o status da conta.');
    }
  }

  if (isLoading) return <p className="card muted">Carregando contas financeiras...</p>;

  return (
    <section className="stack" aria-labelledby="accounts-title">
      <div>
        <h1 id="accounts-title">Contas financeiras</h1>
        <p className="muted">Cadastre contas por perfil, moeda e finalidade. Cada conta permanece isolada no perfil financeiro selecionado.</p>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      <form className="card form-grid" onSubmit={createAccount}>
        <label>
          Perfil financeiro
          <select name="financialProfileId" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} required disabled={isSubmitting}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>

        <label>
          Nome da conta
          <input name="name" minLength={2} maxLength={80} placeholder="Ex.: Millennium Conta Corrente" required disabled={isSubmitting} />
        </label>

        <label>
          Tipo
          <select name="type" required disabled={isSubmitting}>
            {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>

        <label>
          Moeda
          <select name="currencyCode" defaultValue={selectedProfile?.baseCurrency ?? 'EUR'} required disabled={isSubmitting}>
            <option value="EUR">EUR</option>
            <option value="BRL">BRL</option>
          </select>
        </label>

        <label>
          Saldo inicial
          <input name="initialBalance" type="number" step="0.01" defaultValue="0.00" required disabled={isSubmitting} />
        </label>

        <label className="full-width">
          Observações
          <input name="description" maxLength={240} placeholder="Opcional" disabled={isSubmitting} />
        </label>

        <button className="btn full-width" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Criar conta'}</button>
      </form>

      {!accounts.length ? (
        <div className="card empty-state">
          <h2>Nenhuma conta cadastrada</h2>
          <p className="muted">Crie sua primeira conta BRL ou EUR para começar a visualizar saldos por perfil e saldos consolidados.</p>
        </div>
      ) : (
        <div className="table-card" role="region" aria-label="Lista de contas financeiras">
          <table>
            <thead>
              <tr><th>Conta</th><th>Perfil</th><th>Tipo</th><th>Moeda</th><th>Saldo atual</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.name}</strong><br /><span className="muted">{account.description || 'Sem observações'}</span></td>
                  <td>{account.financialProfile?.name}</td>
                  <td>{accountTypes.find((type) => type.value === account.type)?.label ?? account.type}</td>
                  <td>{account.currencyCode}</td>
                  <td>{formatMoney(account.currentBalance, account.currencyCode)}</td>
                  <td><span className="badge">{account.status}</span></td>
                  <td className="actions">
                    {account.status === 'ACTIVE' && <button className="btn secondary small" type="button" onClick={() => void changeStatus(account.id, 'archive')}>Arquivar</button>}
                    {account.status !== 'CLOSED' && <button className="btn danger small" type="button" onClick={() => void changeStatus(account.id, 'close')}>Fechar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
