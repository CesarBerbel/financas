'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, getApiErrorMessage, isUnauthorized } from '../../lib/api';
import { formatMoneyInput, moneyInputPlaceholder, parseMoneyInputToDecimal } from '../../lib/money';

type Profile = { id: string; name: string; type: string; baseCurrency: string; status: string };
type Account = {
  id: string;
  financialProfileId: string;
  name: string;
  currencyCode: string;
  status: string;
  financialProfile?: { id: string; name: string; type: string };
};
type Category = {
  id: string;
  financialProfileId?: string | null;
  parentId?: string | null;
  name: string;
  fullName?: string;
  financialProfile?: { id: string; name: string; type: string } | null;
  parent?: { id: string; name: string } | null;
};
type Transaction = {
  id: string;
  financialProfileId: string;
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  type: string;
  amount: string;
  currencyCode: string;
  description: string;
  categoryName?: string | null;
  occurredAt: string;
  notes?: string | null;
  financialProfile?: { id: string; name: string; type: string };
  account?: { id: string; name: string; currencyCode: string };
  destinationAccount?: { id: string; name: string; currencyCode: string } | null;
  category?: { id: string; name: string; parent?: { id: string; name: string } | null } | null;
  tags?: { tag: { id: string; name: string } }[];
};

type ScreenMode = 'list' | 'create' | 'edit';
type NewCategoryFormState = { financialProfileId: string; parentId: string; name: string };
type TransactionFormState = {
  id?: string;
  financialProfileId: string;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  type: string;
  amount: string;
  occurredAt: string;
  description: string;
  tagsText: string;
  notes: string;
};

type FiltersState = {
  financialProfileId: string;
  accountId: string;
  categoryId: string;
  tag: string;
  dateFrom: string;
  dateTo: string;
};

const transactionTypes = [
  { value: 'INCOME', label: 'Receita' },
  { value: 'EXPENSE', label: 'Despesa' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'ADJUSTMENT', label: 'Ajuste de saldo' },
];

const emptyFilters: FiltersState = { financialProfileId: '', accountId: '', categoryId: '', tag: '', dateFrom: '', dateTo: '' };
const emptyCategoryForm: NewCategoryFormState = { financialProfileId: '', parentId: '', name: '' };
const emptyForm: TransactionFormState = {
  financialProfileId: '',
  accountId: '',
  destinationAccountId: '',
  categoryId: '',
  type: 'EXPENSE',
  amount: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  description: '',
  tagsText: '',
  notes: '',
};

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(new Date(value));
}

function typeLabel(type: string) {
  return transactionTypes.find((item) => item.value === type)?.label ?? type;
}

function typeTone(type: string) {
  if (type === 'INCOME') return 'positive';
  if (type === 'EXPENSE') return 'negative';
  if (type === 'TRANSFER') return 'neutral';
  return 'warning';
}

function displayAmount(transaction: Transaction) {
  if (transaction.type === 'EXPENSE' || transaction.type === 'TRANSFER') return `-${formatMoney(transaction.amount, transaction.currencyCode)}`;
  return formatMoney(transaction.amount, transaction.currencyCode);
}

function accountName(accounts: Account[], accountId: string) {
  return accounts.find((account) => account.id === accountId)?.name ?? 'Conta não encontrada';
}

function categoryLabel(category: Category) {
  const label = category.fullName ?? (category.parent ? `${category.parent.name} > ${category.name}` : category.name);
  return category.financialProfile?.name ? `${label} · ${category.financialProfile.name}` : `${label} · Global`;
}

function transactionCategoryLabel(transaction: Transaction, categoriesById: Map<string, Category>) {
  if (transaction.categoryId && categoriesById.has(transaction.categoryId)) return categoriesById.get(transaction.categoryId)?.fullName ?? categoriesById.get(transaction.categoryId)?.name;
  if (transaction.category?.parent) return `${transaction.category.parent.name} > ${transaction.category.name}`;
  return transaction.category?.name ?? transaction.categoryName ?? 'Sem categoria';
}

function tagsFromText(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildQuery(filters: FiltersState) {
  const params = new URLSearchParams();
  if (filters.financialProfileId) params.set('financialProfileId', filters.financialProfileId);
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.tag.trim()) params.set('tag', filters.tag.trim());
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `/transactions?${query}` : '/transactions';
}

export function TransactionManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [formState, setFormState] = useState<TransactionFormState>(emptyForm);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormState, setCategoryFormState] = useState<NewCategoryFormState>(emptyCategoryForm);
  const [categoryModalError, setCategoryModalError] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === 'ACTIVE'), [accounts]);
  const selectedSourceAccount = useMemo(() => activeAccounts.find((account) => account.id === formState.accountId), [activeAccounts, formState.accountId]);
  const formCurrency = selectedSourceAccount?.currencyCode ?? profiles.find((profile) => profile.id === formState.financialProfileId)?.baseCurrency ?? 'EUR';
  const sourceAccounts = useMemo(
    () => activeAccounts.filter((account) => !formState.financialProfileId || account.financialProfileId === formState.financialProfileId),
    [activeAccounts, formState.financialProfileId],
  );
  const destinationAccounts = useMemo(
    () => activeAccounts.filter((account) => account.id !== formState.accountId && account.currencyCode === selectedSourceAccount?.currencyCode),
    [activeAccounts, formState.accountId, selectedSourceAccount?.currencyCode],
  );
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const formCategories = useMemo(
    () => categories.filter((category) => !category.financialProfileId || category.financialProfileId === formState.financialProfileId),
    [categories, formState.financialProfileId],
  );
  const filterCategories = useMemo(
    () => categories.filter((category) => !filters.financialProfileId || !category.financialProfileId || category.financialProfileId === filters.financialProfileId),
    [categories, filters.financialProfileId],
  );
  const inlineRootCategoryOptions = useMemo(
    () => categories.filter((category) => !category.parentId && (!categoryFormState.financialProfileId || !category.financialProfileId || category.financialProfileId === categoryFormState.financialProfileId)),
    [categories, categoryFormState.financialProfileId],
  );

  const loadBaseData = useCallback(async () => {
    const [profileResult, accountResult, categoryResult] = await Promise.all([
      authApi('/financial-profiles'),
      authApi('/accounts'),
      authApi('/categories'),
    ]);
    const activeProfiles = Array.isArray(profileResult) ? profileResult.filter((profile: Profile) => profile.status === 'ACTIVE') : [];
    const loadedAccounts = Array.isArray(accountResult) ? accountResult.filter((account: Account) => account.status === 'ACTIVE') : [];
    const loadedCategories = Array.isArray(categoryResult) ? categoryResult : [];
    setProfiles(activeProfiles);
    setAccounts(loadedAccounts);
    setCategories(loadedCategories);
    return { activeProfiles, loadedAccounts, loadedCategories };
  }, []);

  const loadTransactions = useCallback(async (nextFilters: FiltersState = filters) => {
    const result = await authApi(buildQuery(nextFilters));
    setTransactions(Array.isArray(result) ? result : []);
  }, [filters]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      await loadBaseData();
      await loadTransactions(filters);
    } catch (error) {
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para carregar suas transações.'
          : `Não foi possível carregar transações. ${getApiErrorMessage(error, 'Verifique se a API está rodando e se a migration da Fase 3 foi aplicada.')}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, loadBaseData, loadTransactions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm(activeProfiles = profiles, loadedAccounts = activeAccounts) {
    const firstProfile = activeProfiles[0];
    const firstAccount = loadedAccounts.find((account) => account.financialProfileId === firstProfile?.id) ?? loadedAccounts[0];
    setFormState({
      ...emptyForm,
      financialProfileId: firstProfile?.id ?? firstAccount?.financialProfileId ?? '',
      accountId: firstAccount?.id ?? '',
      occurredAt: new Date().toISOString().slice(0, 10),
    });
  }

  function openCreateForm() {
    setError('');
    setSuccess('');
    resetForm();
    setMode('create');
  }

  function openEditForm(transaction: Transaction) {
    setError('');
    setSuccess('');
    setFormState({
      id: transaction.id,
      financialProfileId: transaction.financialProfileId,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId ?? '',
      categoryId: transaction.categoryId ?? '',
      type: transaction.type,
      amount: transaction.amount,
      occurredAt: transaction.occurredAt.slice(0, 10),
      description: transaction.description,
      tagsText: transaction.tags?.map((item) => item.tag.name).join(', ') ?? '',
      notes: transaction.notes ?? '',
    });
    setMode('edit');
  }

  function cancelForm() {
    setMode('list');
    resetForm();
  }

  function updateFilter(field: keyof FiltersState, value: string) {
    setFilters((current) => ({ ...current, [field]: value, ...(field === 'financialProfileId' ? { accountId: '', categoryId: '' } : {}) }));
  }

  function updateFormField(field: keyof TransactionFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function updateFormProfile(profileId: string) {
    const firstAccount = activeAccounts.find((account) => account.financialProfileId === profileId);
    setFormState((current) => ({
      ...current,
      financialProfileId: profileId,
      accountId: firstAccount?.id ?? '',
      destinationAccountId: '',
      categoryId: '',
    }));
  }

  function updateFormAccount(accountId: string) {
    setFormState((current) => ({ ...current, accountId, destinationAccountId: '' }));
  }

  function updateInlineCategoryField(field: keyof NewCategoryFormState, value: string) {
    setCategoryFormState((current) => ({ ...current, [field]: value, ...(field === 'financialProfileId' ? { parentId: '' } : {}) }));
  }

  function openInlineCategoryModal() {
    setError('');
    setSuccess('');
    setCategoryModalError('');

    if (!formState.financialProfileId) {
      setError('Selecione um perfil financeiro antes de criar uma categoria para a transação.');
      return;
    }

    setCategoryFormState({ financialProfileId: formState.financialProfileId, parentId: '', name: '' });
    setIsCategoryModalOpen(true);
  }

  function closeInlineCategoryModal() {
    if (isCategorySubmitting) return;
    setIsCategoryModalOpen(false);
    setCategoryModalError('');
    setCategoryFormState(emptyCategoryForm);
  }

  async function saveInlineCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryModalError('');
    setIsCategorySubmitting(true);

    const payload = {
      financialProfileId: categoryFormState.financialProfileId || undefined,
      parentId: categoryFormState.parentId || undefined,
      name: categoryFormState.name.trim(),
    };

    try {
      const createdCategory = (await authApi('/categories', { method: 'POST', body: JSON.stringify(payload) })) as Category;
      const { loadedCategories } = await loadBaseData();
      const categoryStillAvailable = loadedCategories.some((category) => category.id === createdCategory.id);

      if (!createdCategory?.id || !categoryStillAvailable) {
        setCategoryModalError('Categoria criada, mas não foi possível selecioná-la automaticamente. Feche este modal e atualize a lista de categorias.');
        return;
      }

      setFormState((current) => ({ ...current, categoryId: createdCategory.id }));
      setSuccess(`Categoria "${createdCategory.fullName ?? createdCategory.name}" criada e selecionada na transação.`);
      setIsCategoryModalOpen(false);
      setCategoryModalError('');
      setCategoryFormState(emptyCategoryForm);
    } catch (error) {
      setCategoryModalError(`Não foi possível criar a categoria. ${getApiErrorMessage(error, 'Verifique o nome, o perfil e tente novamente.')}`);
    } finally {
      setIsCategorySubmitting(false);
    }
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loadTransactions(filters);
    } catch (error) {
      setError(`Não foi possível filtrar transações. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loadTransactions(emptyFilters);
    } catch (error) {
      setError(`Não foi possível limpar os filtros. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const payload = {
      financialProfileId: formState.financialProfileId,
      accountId: formState.accountId,
      destinationAccountId: formState.type === 'TRANSFER' ? formState.destinationAccountId : undefined,
      categoryId: formState.categoryId || (mode === 'edit' ? null : undefined),
      type: formState.type,
      amount: formState.amount,
      occurredAt: formState.occurredAt,
      description: formState.description.trim(),
      tags: tagsFromText(formState.tagsText),
      notes: formState.notes.trim() || undefined,
    };

    try {
      if (mode === 'edit' && formState.id) {
        await authApi(`/transactions/${formState.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setSuccess('Transação atualizada com categoria, tags e saldo recalculado.');
      } else {
        await authApi('/transactions', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Transação criada com categoria, tags e saldo atualizado.');
      }

      setMode('list');
      resetForm();
      await loadBaseData();
      await loadTransactions(filters);
    } catch (error) {
      setError(`${mode === 'edit' ? 'Não foi possível editar a transação.' : 'Não foi possível criar a transação.'} ${getApiErrorMessage(error, 'Verifique os campos e tente novamente.')}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTransaction(transactionId: string) {
    if (!window.confirm('Excluir esta transação? O saldo da conta será recalculado automaticamente.')) return;

    setError('');
    setSuccess('');
    try {
      await authApi(`/transactions/${transactionId}`, { method: 'DELETE' });
      setSuccess('Transação excluída e saldo recalculado.');
      await loadBaseData();
      await loadTransactions(filters);
    } catch (error) {
      setError(`Não foi possível excluir a transação. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    }
  }

  if (isLoading && !transactions.length) return <p className="card muted">Carregando transações financeiras...</p>;

  const isFormOpen = mode !== 'list';
  const isEditing = mode === 'edit';

  return (
    <section className="stack" aria-labelledby="transactions-title">
      <div className="page-header">
        <div>
          <h1 id="transactions-title">Transações financeiras</h1>
          <p className="muted">Registre receitas, despesas, transferências e ajustes. Cada lançamento atualiza saldo, categoria e tags.</p>
        </div>
        <button className="btn" type="button" onClick={openCreateForm}>Adicionar transação</button>
      </div>

      {error && !isFormOpen && !isCategoryModalOpen && <p className="alert">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      <form className="card compact-filter-grid" onSubmit={applyFilters}>
        <label>
          Perfil
          <select value={filters.financialProfileId} onChange={(event) => updateFilter('financialProfileId', event.target.value)}>
            <option value="">Todos</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <label>
          Conta
          <select value={filters.accountId} onChange={(event) => updateFilter('accountId', event.target.value)}>
            <option value="">Todas</option>
            {activeAccounts
              .filter((account) => !filters.financialProfileId || account.financialProfileId === filters.financialProfileId)
              .map((account) => <option key={account.id} value={account.id}>{account.name} - {account.currencyCode}</option>)}
          </select>
        </label>
        <label>
          Categoria
          <select value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)}>
            <option value="">Todas</option>
            {filterCategories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category)}</option>)}
          </select>
        </label>
        <label>
          Tag
          <input value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)} placeholder="Buscar tag" />
        </label>
        <label>
          De
          <input value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} type="date" />
        </label>
        <label>
          Até
          <input value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} type="date" />
        </label>
        <div className="actions filter-actions">
          <button className="btn small" type="submit">Filtrar</button>
          <button className="btn secondary small" type="button" onClick={() => void clearFilters()}>Limpar</button>
          <Link className="btn secondary small" href="/categories">Relatório</Link>
        </div>
      </form>

      {!transactions.length ? (
        <div className="card empty-state">
          <h2>Nenhuma transação encontrada</h2>
          <p className="muted">Adicione uma receita, despesa, transferência ou ajuste para movimentar suas contas.</p>
          <button className="btn" type="button" onClick={openCreateForm} disabled={!profiles.length || !activeAccounts.length}>Adicionar transação</button>
        </div>
      ) : (
        <div className="transaction-list" aria-label="Lista de transações financeiras">
          {transactions.map((transaction) => (
            <article className="card transaction-card" key={transaction.id}>
              <div className="transaction-card-main">
                <div>
                  <h2>{transaction.description}</h2>
                  <p className="muted">
                    {formatDate(transaction.occurredAt)} · {transaction.financialProfile?.name ?? 'Perfil'} · {transaction.account?.name ?? accountName(activeAccounts, transaction.accountId)}
                    {transaction.destinationAccount ? ` → ${transaction.destinationAccount.name}` : ''}
                  </p>
                </div>
                <strong className={`transaction-amount ${typeTone(transaction.type)}`}>{displayAmount(transaction)}</strong>
              </div>

              <div className="transaction-card-details">
                <span className="badge">{typeLabel(transaction.type)}</span>
                <span>{transactionCategoryLabel(transaction, categoriesById)}</span>
                <span>{transaction.currencyCode}</span>
                {transaction.tags?.map((item) => <span className="badge light" key={item.tag.id}>{item.tag.name}</span>)}
              </div>

              {transaction.notes && <p className="muted transaction-notes">{transaction.notes}</p>}

              <div className="actions">
                <button className="btn secondary small" type="button" onClick={() => openEditForm(transaction)}>Editar</button>
                <button className="btn danger small" type="button" onClick={() => void deleteTransaction(transaction.id)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
            <div className="modal-header">
              <div>
                <h2 id="transaction-form-title">{isEditing ? 'Editar transação' : 'Adicionar transação'}</h2>
                <p className="muted">Receitas aumentam saldo, despesas reduzem saldo, transferências movem saldo entre contas da mesma moeda.</p>
              </div>
              <button className="btn secondary small" type="button" onClick={cancelForm} disabled={isSubmitting} aria-label="Fechar formulário de transação">Fechar</button>
            </div>

            {error && <p className="alert">{error}</p>}

            <form className="form-grid" onSubmit={saveTransaction}>
              <label>
                Tipo
                <select value={formState.type} onChange={(event) => updateFormField('type', event.target.value)} required disabled={isSubmitting}>
                  {transactionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>

              <label>
                Perfil financeiro
                <select value={formState.financialProfileId} onChange={(event) => updateFormProfile(event.target.value)} required disabled={isSubmitting || !profiles.length}>
                  <option value="" disabled>Selecione um perfil</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select>
              </label>

              <label>
                Conta
                <select value={formState.accountId} onChange={(event) => updateFormAccount(event.target.value)} required disabled={isSubmitting || !sourceAccounts.length}>
                  <option value="" disabled>Selecione uma conta</option>
                  {sourceAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {account.currencyCode}</option>)}
                </select>
              </label>

              {formState.type === 'TRANSFER' && (
                <label>
                  Conta de destino
                  <select value={formState.destinationAccountId} onChange={(event) => updateFormField('destinationAccountId', event.target.value)} required disabled={isSubmitting || !destinationAccounts.length}>
                    <option value="" disabled>Selecione o destino</option>
                    {destinationAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {account.currencyCode}</option>)}
                  </select>
                </label>
              )}

              <label>
                Valor
                <input
                  value={formatMoneyInput(formState.amount, formCurrency)}
                  onChange={(event) => updateFormField('amount', parseMoneyInputToDecimal(event.target.value))}
                  type="text"
                  inputMode="decimal"
                  placeholder={moneyInputPlaceholder(formCurrency)}
                  required
                  disabled={isSubmitting}
                  autoFocus
                />
              </label>

              <label>
                Data
                <input value={formState.occurredAt} onChange={(event) => updateFormField('occurredAt', event.target.value)} type="date" required disabled={isSubmitting} />
              </label>

              <label className="full-width">
                Descrição
                <input value={formState.description} onChange={(event) => updateFormField('description', event.target.value)} minLength={2} maxLength={160} placeholder="Ex.: Mercado, salário, transferência para reserva" required disabled={isSubmitting} />
              </label>

              <div className="field-stack">
                <div className="field-label-row">
                  <span>Categoria</span>
                  <button className="btn secondary small inline-action" type="button" onClick={openInlineCategoryModal} disabled={isSubmitting || !formState.financialProfileId}>+ nova categoria</button>
                </div>
                <select value={formState.categoryId} onChange={(event) => updateFormField('categoryId', event.target.value)} disabled={isSubmitting} aria-label="Categoria">
                  <option value="">Sem categoria</option>
                  {formCategories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category)}</option>)}
                </select>
                <small className="muted">Crie uma categoria sem sair do lançamento.</small>
              </div>

              <label>
                Tags livres
                <input value={formState.tagsText} onChange={(event) => updateFormField('tagsText', event.target.value)} maxLength={240} placeholder="Ex.: recorrente, imposto, reembolso" disabled={isSubmitting} />
              </label>

              <label className="full-width">
                Observações
                <input value={formState.notes} onChange={(event) => updateFormField('notes', event.target.value)} maxLength={240} placeholder="Opcional" disabled={isSubmitting} />
              </label>

              <div className="actions full-width">
                <button className="btn" type="submit" disabled={isSubmitting || !profiles.length || !sourceAccounts.length || (formState.type === 'TRANSFER' && !destinationAccounts.length)}>
                  {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar transação'}
                </button>
                <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Cancelar</button>
              </div>

              {!profiles.length && <p className="alert full-width">Cadastre um perfil financeiro antes de lançar transações. <Link href="/profiles">Ir para perfis</Link>.</p>}
              {profiles.length > 0 && !activeAccounts.length && <p className="alert full-width">Cadastre uma conta ativa antes de lançar transações. <Link href="/accounts">Ir para contas</Link>.</p>}
              {formState.type === 'TRANSFER' && sourceAccounts.length > 0 && !destinationAccounts.length && (
                <p className="alert full-width">Para transferir, é necessário ter outra conta ativa na mesma moeda da conta de origem.</p>
              )}
            </form>
          </section>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="modal-backdrop modal-backdrop-stacked" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="inline-category-title">
            <div className="modal-header">
              <div>
                <h2 id="inline-category-title">Nova categoria</h2>
                <p className="muted">Crie uma categoria ou subcategoria para usar nesta transação.</p>
              </div>
              <button className="btn secondary small" type="button" onClick={closeInlineCategoryModal} disabled={isCategorySubmitting} aria-label="Fechar modal de nova categoria">Fechar</button>
            </div>

            {categoryModalError && <p className="alert">{categoryModalError}</p>}

            <form className="form-grid" onSubmit={saveInlineCategory}>
              <label>
                Perfil financeiro
                <select value={categoryFormState.financialProfileId} onChange={(event) => updateInlineCategoryField('financialProfileId', event.target.value)} required disabled={isCategorySubmitting || !profiles.length}>
                  <option value="" disabled>Selecione um perfil</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select>
              </label>

              <label>
                Categoria principal
                <select value={categoryFormState.parentId} onChange={(event) => updateInlineCategoryField('parentId', event.target.value)} disabled={isCategorySubmitting}>
                  <option value="">Nenhuma, será categoria principal</option>
                  {inlineRootCategoryOptions.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category)}</option>)}
                </select>
              </label>

              <label className="full-width">
                Nome
                <input value={categoryFormState.name} onChange={(event) => updateInlineCategoryField('name', event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Saúde, Supermercado, IVA" required disabled={isCategorySubmitting} autoFocus />
              </label>

              <div className="actions full-width">
                <button className="btn" type="submit" disabled={isCategorySubmitting || !categoryFormState.financialProfileId}>{isCategorySubmitting ? 'Criando...' : 'Criar e selecionar'}</button>
                <button className="btn secondary" type="button" onClick={closeInlineCategoryModal} disabled={isCategorySubmitting}>Cancelar</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
