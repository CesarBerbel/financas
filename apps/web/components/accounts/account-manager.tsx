'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { authApi, getApiErrorMessage, isUnauthorized } from '../../lib/api';
import { formatMoneyInput, moneyInputPlaceholder, parseMoneyInputToDecimal } from '../../lib/money';

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

type ScreenMode = 'list' | 'create' | 'edit';

type AccountGroup = {
  key: string;
  profileName: string;
  profileType: string;
  accounts: Account[];
};

type AccountFormState = {
  id?: string;
  financialProfileId: string;
  name: string;
  type: string;
  currencyCode: string;
  initialBalance: string;
  description: string;
};

const accountTypes = [
  { value: 'CHECKING', label: 'Conta corrente' },
  { value: 'SAVINGS', label: 'Poupança' },
  { value: 'WALLET', label: 'Carteira' },
  { value: 'INVESTMENT', label: 'Investimento' },
  { value: 'BUSINESS', label: 'Empresarial' },
  { value: 'RESERVE', label: 'Reserva' },
];

const emptyForm: AccountFormState = {
  financialProfileId: '',
  name: '',
  type: 'CHECKING',
  currencyCode: 'EUR',
  initialBalance: '',
  description: '',
};

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
}

function accountTypeLabel(type: string) {
  return accountTypes.find((item) => item.value === type)?.label ?? type;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: 'Ativa',
    ARCHIVED: 'Arquivada',
    CLOSED: 'Fechada',
    READ_ONLY: 'Somente leitura',
    PENDING_RECONCILIATION: 'Aguardando conciliação',
    BALANCE_DIVERGENCE: 'Com divergência de saldo',
  };
  return labels[status] ?? status;
}

function profileTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PERSONAL_BRAZIL: 'Pessoal Brasil',
    PERSONAL_PORTUGAL: 'Pessoal Portugal',
    BUSINESS_PORTUGAL: 'Empresarial Portugal',
    BUSINESS_USA: 'Empresarial USA',
  };
  return labels[type] ?? type;
}

function buildAccountGroups(accounts: Account[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();

  for (const account of accounts) {
    const key = account.financialProfileId || 'unknown-profile';
    const existing = groups.get(key);

    if (existing) {
      existing.accounts.push(account);
      continue;
    }

    groups.set(key, {
      key,
      profileName: account.financialProfile?.name ?? 'Perfil não informado',
      profileType: account.financialProfile?.type ?? 'UNKNOWN',
      accounts: [account],
    });
  }

  return Array.from(groups.values()).sort((first, second) => first.profileName.localeCompare(second.profileName, 'pt-BR'));
}

function groupBalanceByCurrency(accounts: Account[]) {
  const totals = new Map<string, number>();

  for (const account of accounts) {
    totals.set(account.currencyCode, (totals.get(account.currencyCode) ?? 0) + Number(account.currentBalance));
  }

  return Array.from(totals.entries())
    .sort(([firstCurrency], [secondCurrency]) => firstCurrency.localeCompare(secondCurrency))
    .map(([currencyCode, total]) => formatMoney(total, currencyCode))
    .join(' · ');
}

function accountHasBalance(account: Account) {
  return Math.abs(Number(account.currentBalance)) > 0;
}

function canEditAccount(account: Account) {
  return account.status === 'ACTIVE';
}

function canArchiveAccount(account: Account) {
  return account.status === 'ACTIVE' && !accountHasBalance(account);
}

function canCloseAccount(account: Account) {
  return account.status === 'ACTIVE' && !accountHasBalance(account);
}

function getEditDisabledTitle(account: Account) {
  if (account.status === 'ARCHIVED') return 'Conta arquivada não pode ser editada. Desarquive antes de editar.';
  if (account.status === 'CLOSED') return 'Conta fechada não pode ser editada.';
  return undefined;
}

function getArchiveDisabledTitle(account: Account) {
  if (accountHasBalance(account)) return 'Conta com saldo diferente de zero não pode ser arquivada.';
  return undefined;
}

function getCloseDisabledTitle(account: Account) {
  if (accountHasBalance(account)) return 'Conta com saldo diferente de zero não pode ser fechada.';
  return undefined;
}

export function AccountManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [formState, setFormState] = useState<AccountFormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedProfileIds, setCollapsedProfileIds] = useState<Set<string>>(() => new Set());
  const [showArchived, setShowArchived] = useState(false);

  const normalizeProfiles = useCallback((result: unknown): Profile[] => {
    return Array.isArray(result) ? result.filter((profile: Profile) => profile.status === 'ACTIVE') : [];
  }, []);

  const applyProfiles = useCallback((activeProfiles: Profile[]) => {
    setProfiles(activeProfiles);
    setFormState((current) => {
      if (current.financialProfileId && activeProfiles.some((profile) => profile.id === current.financialProfileId)) {
        return current;
      }

      const firstProfile = activeProfiles[0];
      return {
        ...current,
        financialProfileId: firstProfile?.id ?? '',
        currencyCode: firstProfile?.baseCurrency ?? current.currencyCode,
      };
    });
  }, []);

  const reloadProfiles = useCallback(async () => {
    try {
      const profileResult = await authApi('/financial-profiles');
      applyProfiles(normalizeProfiles(profileResult));
    } catch (error) {
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para atualizar os perfis financeiros.'
          : `Não foi possível atualizar os perfis financeiros. ${getApiErrorMessage(error, 'Tente novamente em instantes.')}`,
      );
    }
  }, [applyProfiles, normalizeProfiles]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const profileResult = await authApi('/financial-profiles');
      applyProfiles(normalizeProfiles(profileResult));
    } catch (error) {
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para carregar seus perfis financeiros.'
          : `Não foi possível carregar perfis financeiros. ${getApiErrorMessage(error, 'Tente novamente em instantes.')}`,
      );
      setIsLoading(false);
      return;
    }

    try {
      const accountResult = await authApi('/accounts');
      setAccounts(Array.isArray(accountResult) ? accountResult : []);
    } catch (error) {
      setAccounts([]);
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para carregar suas contas.'
          : `Não foi possível carregar contas. ${getApiErrorMessage(error, 'Verifique se a API está rodando e se a migration da Fase 1 foi aplicada.')}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyProfiles, normalizeProfiles]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function handleFocus() {
      void reloadProfiles();
    }

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reloadProfiles]);

  function openCreateForm() {
    const firstProfile = profiles[0];
    setSuccess('');
    setError('');
    setFormState({
      ...emptyForm,
      financialProfileId: firstProfile?.id ?? '',
      currencyCode: firstProfile?.baseCurrency ?? 'EUR',
    });
    setMode('create');
  }

  function openEditForm(account: Account) {
    setSuccess('');
    setError('');
    setFormState({
      id: account.id,
      financialProfileId: account.financialProfileId,
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      initialBalance: account.initialBalance,
      description: account.description ?? '',
    });
    setMode('edit');
  }

  function cancelForm() {
    setFormState(emptyForm);
    setMode('list');
  }

  function updateFormField(field: keyof AccountFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function updateProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    setFormState((current) => ({
      ...current,
      financialProfileId: profileId,
      currencyCode: profile?.baseCurrency ?? current.currencyCode,
    }));
  }

  function toggleProfileGroup(profileId: string) {
    setCollapsedProfileIds((current) => {
      const next = new Set(current);

      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }

      return next;
    });
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (mode === 'edit' && formState.id) {
        await authApi(`/accounts/${formState.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formState.name.trim(),
            type: formState.type,
            description: formState.description.trim() || undefined,
          }),
        });
        setSuccess('Conta atualizada com sucesso.');
      } else {
        await authApi('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            financialProfileId: formState.financialProfileId,
            name: formState.name.trim(),
            type: formState.type,
            currencyCode: formState.currencyCode,
            initialBalance: formState.initialBalance,
            description: formState.description.trim() || undefined,
          }),
        });
        setSuccess('Conta criada com sucesso.');
      }

      setMode('list');
      setFormState(emptyForm);
      await loadData();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Verifique os campos e tente novamente.');
      setError(mode === 'edit' ? `Não foi possível editar a conta. ${message}` : `Não foi possível criar a conta. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeStatus(accountId: string, action: 'archive' | 'unarchive' | 'close') {
    if (action === 'close' && !window.confirm('Tem certeza que deseja fechar esta conta? Ela não aparecerá mais nas listas operacionais e ficará disponível futuramente apenas em relatórios.')) {
      return;
    }

    const successMessages = {
      archive: 'Conta arquivada.',
      unarchive: 'Conta desarquivada.',
      close: 'Conta fechada.',
    };

    setError('');
    setSuccess('');
    try {
      await authApi(`/accounts/${accountId}/${action}`, { method: 'POST' });
      setSuccess(successMessages[action]);
      await loadData();
    } catch (error) {
      setError(`Não foi possível alterar o status da conta. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    }
  }

  if (isLoading) return <p className="card muted">Carregando contas financeiras...</p>;

  if (mode !== 'list') {
    const isEditing = mode === 'edit';

    return (
      <section className="stack" aria-labelledby="account-form-title">
        <div className="page-header">
          <div>
            <h1 id="account-form-title">{isEditing ? 'Editar conta' : 'Adicionar nova conta'}</h1>
            <p className="muted">
              {isEditing
                ? 'Atualize os dados cadastrais da conta. Saldos e moeda não são alterados por esta edição.'
                : 'Escolha o perfil financeiro, a moeda BRL, EUR ou USD e o saldo inicial da nova conta.'}
            </p>
          </div>
          <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Voltar para lista</button>
        </div>

        {error && <p className="alert">{error}</p>}

        <form className="card form-grid" onSubmit={saveAccount}>
          <label>
            Perfil financeiro
            <select
              value={formState.financialProfileId}
              onChange={(event) => updateProfile(event.target.value)}
              required
              disabled={isSubmitting || isEditing || !profiles.length}
            >
              <option value="" disabled>Selecione um perfil</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name} - {profile.baseCurrency}</option>
              ))}
            </select>
          </label>

          <label>
            Nome da conta
            <input
              value={formState.name}
              onChange={(event) => updateFormField('name', event.target.value)}
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Millennium Conta Corrente"
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Tipo
            <select value={formState.type} onChange={(event) => updateFormField('type', event.target.value)} required disabled={isSubmitting}>
              {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>

          <label>
            Moeda
            <select value={formState.currencyCode} onChange={(event) => updateFormField('currencyCode', event.target.value)} required disabled={isSubmitting || isEditing || !profiles.length}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label>
            Saldo inicial
            <input
              value={formatMoneyInput(formState.initialBalance, formState.currencyCode)}
              onChange={(event) => updateFormField('initialBalance', parseMoneyInputToDecimal(event.target.value))}
              type="text"
              inputMode="decimal"
              placeholder={moneyInputPlaceholder(formState.currencyCode)}
              required
              disabled={isSubmitting || isEditing}
            />
          </label>

          <label className="full-width">
            Observações
            <input
              value={formState.description}
              onChange={(event) => updateFormField('description', event.target.value)}
              maxLength={240}
              placeholder="Opcional"
              disabled={isSubmitting}
            />
          </label>

          <div className="actions full-width">
            <button className="btn" type="submit" disabled={isSubmitting || !profiles.length}>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar conta'}</button>
            <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Cancelar</button>
          </div>

          {!profiles.length && (
            <p className="alert full-width">
              Cadastre pelo menos um perfil financeiro ativo antes de criar contas.{' '}
              <Link href="/profiles">Ir para perfis</Link>.
            </p>
          )}
        </form>
      </section>
    );
  }

  const operationalAccounts = accounts.filter((account) => account.status !== 'CLOSED');
  const archivedAccountCount = operationalAccounts.filter((account) => account.status === 'ARCHIVED').length;
  const visibleAccounts = showArchived ? operationalAccounts : operationalAccounts.filter((account) => account.status !== 'ARCHIVED');
  const accountGroups = buildAccountGroups(visibleAccounts);

  return (
    <section className="stack" aria-labelledby="accounts-title">
      <div className="page-header">
        <div>
          <h1 id="accounts-title">Contas financeiras</h1>
          <p className="muted">Lista de contas por perfil, moeda e finalidade. Use os cartões para editar, arquivar ou fechar uma conta.</p>
        </div>
        <div className="actions account-list-actions">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              disabled={archivedAccountCount === 0}
            />
            Mostrar arquivadas{archivedAccountCount > 0 ? ` (${archivedAccountCount})` : ''}
          </label>
          <button className="btn" type="button" onClick={openCreateForm}>Adicionar nova conta</button>
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      {!profiles.length && (
        <p className="alert">
          Cadastre pelo menos um perfil financeiro ativo antes de criar contas.{' '}
          <Link href="/profiles">Ir para perfis</Link>.
        </p>
      )}

      {!visibleAccounts.length ? (
        <div className="card empty-state">
          <h2>{operationalAccounts.length ? 'Nenhuma conta ativa na visualização atual' : 'Nenhuma conta cadastrada'}</h2>
          <p className="muted">
            {operationalAccounts.length
              ? 'Marque “Mostrar arquivadas” para visualizar contas arquivadas.'
              : 'Clique em “Adicionar nova conta” para criar sua primeira conta BRL, EUR ou USD.'}
          </p>
          {!operationalAccounts.length && <button className="btn" type="button" onClick={openCreateForm} disabled={!profiles.length}>Adicionar nova conta</button>}
        </div>
      ) : (
        <div className="account-profile-groups" aria-label="Contas financeiras agrupadas por perfil">
          {accountGroups.map((group) => {
            const isCollapsed = collapsedProfileIds.has(group.key);

            return (
              <section className="account-profile-group" key={group.key} aria-labelledby={`account-group-${group.key}`}>
                <button
                  className="account-profile-group-header"
                  type="button"
                  onClick={() => toggleProfileGroup(group.key)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`account-group-panel-${group.key}`}
                  aria-label={isCollapsed ? `Expandir contas do perfil ${group.profileName}` : `Colapsar contas do perfil ${group.profileName}`}
                >
                  <span className="account-profile-group-title">
                    <strong id={`account-group-${group.key}`}>{group.profileName}</strong>
                    <small>{profileTypeLabel(group.profileType)}</small>
                  </span>
                  <span className="account-profile-group-meta">
                    <span>{group.accounts.length} {group.accounts.length === 1 ? 'conta' : 'contas'}</span>
                    <span>{groupBalanceByCurrency(group.accounts)}</span>
                    <span className="account-profile-group-toggle" aria-hidden="true">{isCollapsed ? '▾' : '▴'}</span>
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="card-list" id={`account-group-panel-${group.key}`}>
                    {group.accounts.map((account) => (
                      <article className="card entity-card" key={account.id}>
                        <div className="entity-card-main">
                          <div>
                            <h2>{account.name}</h2>
                            <p className="muted">{account.description || 'Sem observações'}</p>
                          </div>
                          <span className="badge">{statusLabel(account.status)}</span>
                        </div>

                        <div className="entity-card-details">
                          <p><span className="muted">Tipo</span><strong>{accountTypeLabel(account.type)}</strong></p>
                          <p><span className="muted">Moeda</span><strong>{account.currencyCode}</strong></p>
                          <p><span className="muted">Saldo atual</span><strong>{formatMoney(account.currentBalance, account.currencyCode)}</strong></p>
                        </div>

                        <div className="actions">
                          <button
                            className="btn secondary small"
                            type="button"
                            onClick={() => openEditForm(account)}
                            disabled={!canEditAccount(account)}
                            title={getEditDisabledTitle(account)}
                          >
                            Editar
                          </button>
                          {account.status === 'ACTIVE' && (
                            <button
                              className="btn secondary small"
                              type="button"
                              onClick={() => void changeStatus(account.id, 'archive')}
                              disabled={!canArchiveAccount(account)}
                              title={getArchiveDisabledTitle(account)}
                            >
                              Arquivar
                            </button>
                          )}
                          {account.status === 'ARCHIVED' && (
                            <button className="btn secondary small" type="button" onClick={() => void changeStatus(account.id, 'unarchive')}>
                              Desarquivar
                            </button>
                          )}
                          {account.status === 'ACTIVE' && (
                            <button
                              className="btn danger small"
                              type="button"
                              onClick={() => void changeStatus(account.id, 'close')}
                              disabled={!canCloseAccount(account)}
                              title={getCloseDisabledTitle(account)}
                            >
                              Fechar
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
