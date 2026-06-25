'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, getApiErrorMessage, isUnauthorized } from '../../lib/api';

type Profile = { id: string; name: string; type: string; baseCurrency: string; status: string };
type Category = {
  id: string;
  financialProfileId?: string | null;
  parentId?: string | null;
  name: string;
  fullName?: string;
  isDefault: boolean;
  financialProfile?: { id: string; name: string; type: string } | null;
  parent?: { id: string; name: string } | null;
};
type ReportRow = {
  categoryId: string | null;
  categoryName: string;
  parentName: string | null;
  financialProfileId: string;
  financialProfileName: string;
  financialProfileType: string;
  currencyCode: string;
  income: string;
  expense: string;
  net: string;
  transactionCount: number;
};
type DeleteCategoryResponse = { id: string; deleted: boolean; message?: string };
type ScreenMode = 'list' | 'create' | 'edit';
type CategoryFormState = { id?: string; financialProfileId: string; parentId: string; name: string };
type ReportFilters = { financialProfileId: string; dateFrom: string; dateTo: string };

const emptyForm: CategoryFormState = { financialProfileId: '', parentId: '', name: '' };
const emptyReportFilters: ReportFilters = { financialProfileId: '', dateFrom: '', dateTo: '' };

function profileTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PERSONAL_BRAZIL: 'Pessoal Brasil',
    PERSONAL_PORTUGAL: 'Pessoal Portugal',
    BUSINESS_PORTUGAL: 'Empresarial Portugal',
    BUSINESS_USA: 'Empresarial USA',
  };
  return labels[type] ?? type;
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
}

function categoryFullName(category: Category) {
  return category.fullName ?? (category.parent ? `${category.parent.name} > ${category.name}` : category.name);
}

function buildReportQuery(filters: ReportFilters) {
  const params = new URLSearchParams();
  if (filters.financialProfileId) params.set('financialProfileId', filters.financialProfileId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const query = params.toString();
  return query ? `/categories/report?${query}` : '/categories/report';
}

export function CategoryManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [formState, setFormState] = useState<CategoryFormState>(emptyForm);
  const [reportFilters, setReportFilters] = useState<ReportFilters>(emptyReportFilters);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.status === 'ACTIVE'), [profiles]);
  const rootCategoryOptions = useMemo(
    () => categories.filter((category) => !category.parentId && (!formState.financialProfileId || !category.financialProfileId || category.financialProfileId === formState.financialProfileId)),
    [categories, formState.financialProfileId],
  );

  const loadCategories = useCallback(async () => {
    const result = await authApi('/categories');
    const nextCategories = Array.isArray(result) ? result : [];
    setCategories(nextCategories);
    return nextCategories as Category[];
  }, []);

  const loadReport = useCallback(async (filters: ReportFilters = reportFilters) => {
    const result = await authApi(buildReportQuery(filters));
    setReportRows(Array.isArray(result) ? result : []);
  }, [reportFilters]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const profileResult = await authApi('/financial-profiles');
      setProfiles(Array.isArray(profileResult) ? profileResult : []);
      await loadCategories();
      await loadReport(reportFilters);
    } catch (error) {
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para carregar categorias.'
          : `Não foi possível carregar categorias. ${getApiErrorMessage(error, 'Verifique se a API está rodando e se a migration da Fase 3 foi aplicada.')}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadCategories, loadReport, reportFilters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateForm() {
    setError('');
    setSuccess('');
    setFormState({ ...emptyForm, financialProfileId: activeProfiles[0]?.id ?? '' });
    setMode('create');
  }

  function openEditForm(category: Category) {
    setError('');
    setSuccess('');
    setFormState({
      id: category.id,
      financialProfileId: category.financialProfileId ?? '',
      parentId: category.parentId ?? '',
      name: category.name,
    });
    setMode('edit');
  }

  function cancelForm() {
    setMode('list');
    setFormState(emptyForm);
  }

  function updateFormField(field: keyof CategoryFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value, ...(field === 'financialProfileId' ? { parentId: '' } : {}) }));
  }

  function updateReportFilter(field: keyof ReportFilters, value: string) {
    setReportFilters((current) => ({ ...current, [field]: value }));
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const payload = {
      financialProfileId: formState.financialProfileId || undefined,
      parentId: formState.parentId || undefined,
      name: formState.name.trim(),
    };

    try {
      if (mode === 'edit' && formState.id) {
        await authApi(`/categories/${formState.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setSuccess('Categoria atualizada.');
      } else {
        await authApi('/categories', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Categoria criada.');
      }

      setMode('list');
      setFormState(emptyForm);
      await loadCategories();
      await loadReport(reportFilters);
    } catch (error) {
      setError(`${mode === 'edit' ? 'Não foi possível editar a categoria.' : 'Não foi possível criar a categoria.'} ${getApiErrorMessage(error, 'Verifique os campos e tente novamente.')}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeCategory(category: Category) {
    setError('');
    setSuccess('');

    if (category.isDefault) {
      setError(
        `A categoria padrão "${categoryFullName(category)}" não pode ser removida porque faz parte da organização inicial do perfil. Você pode renomeá-la, criar uma subcategoria ou criar uma categoria personalizada.`,
      );
      return;
    }

    if (!window.confirm(`Remover a categoria "${categoryFullName(category)}"? Categorias em uso ou com subcategorias não serão removidas.`)) return;

    try {
      const result = (await authApi(`/categories/${category.id}`, { method: 'DELETE' })) as DeleteCategoryResponse;
      if (!result?.deleted) {
        setError(result?.message || 'A categoria não foi removida. Verifique se ela possui subcategorias ou transações vinculadas.');
        return;
      }

      const nextCategories = await loadCategories();

      if (nextCategories.some((item) => item.id === category.id)) {
        setError('A categoria não foi removida. Verifique se ela possui vínculos ativos ou se é uma categoria padrão do sistema.');
        return;
      }

      setSuccess(result.message || 'Categoria removida.');

      try {
        await loadReport(reportFilters);
      } catch (error) {
        setError(`Categoria removida, mas não foi possível atualizar o relatório. ${getApiErrorMessage(error, 'Atualize a página para tentar novamente.')}`);
      }
    } catch (error) {
      setError(`Não foi possível remover a categoria. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    }
  }

  async function applyReportFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loadReport(reportFilters);
    } catch (error) {
      setError(`Não foi possível atualizar o relatório. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearReportFilters() {
    setReportFilters(emptyReportFilters);
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loadReport(emptyReportFilters);
    } catch (error) {
      setError(`Não foi possível limpar os filtros do relatório. ${getApiErrorMessage(error, 'Tente novamente.')}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && !categories.length && !reportRows.length) return <p className="card muted">Carregando categorias e relatório...</p>;

  const isFormOpen = mode !== 'list';
  const isEditing = mode === 'edit';

  return (
    <section className="stack" aria-labelledby="categories-title">
      <div className="page-header">
        <div>
          <h1 id="categories-title">Categorias e organização</h1>
          <p className="muted">Categorias por perfil, subcategorias e relatório por categoria para a Fase 3.</p>
        </div>
        <button className="btn" type="button" onClick={openCreateForm}>Adicionar categoria</button>
      </div>

      {error && !isFormOpen && <p className="alert">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      {!categories.length ? (
        <div className="card empty-state">
          <h2>Nenhuma categoria encontrada</h2>
          <p className="muted">As categorias padrão são criadas automaticamente para perfis ativos. Você também pode criar uma categoria manual.</p>
          <button className="btn" type="button" onClick={openCreateForm}>Adicionar categoria</button>
        </div>
      ) : (
        <div className="card-list" aria-label="Lista de categorias financeiras">
          {categories.map((category) => (
            <article className="card entity-card" key={category.id}>
              <div className="entity-card-main">
                <div>
                  <h2>{categoryFullName(category)}</h2>
                  <p className="muted">{category.financialProfile ? category.financialProfile.name : 'Global para todos os perfis'}</p>
                </div>
                {category.isDefault && <span className="badge">Padrão</span>}
              </div>

              <div className="entity-card-details">
                <p><span className="muted">Nível</span><strong>{category.parent ? 'Subcategoria' : 'Principal'}</strong></p>
                <p><span className="muted">Perfil</span><strong>{category.financialProfile ? profileTypeLabel(category.financialProfile.type) : 'Global'}</strong></p>
              </div>

              <div className="actions">
                <button className="btn secondary small" type="button" onClick={() => openEditForm(category)}>Editar</button>
                <button
                  className="btn danger small"
                  type="button"
                  onClick={() => void removeCategory(category)}
                  title={category.isDefault ? 'Categorias padrão não podem ser removidas.' : undefined}
                >
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="stack" aria-labelledby="category-report-title">
        <div className="page-header">
          <div>
            <h2 id="category-report-title">Relatório por categoria</h2>
            <p className="muted">Resumo de receitas, despesas e saldo líquido por categoria, perfil e moeda.</p>
          </div>
        </div>

        <form className="card compact-filter-grid" onSubmit={applyReportFilters}>
          <label>
            Perfil
            <select value={reportFilters.financialProfileId} onChange={(event) => updateReportFilter('financialProfileId', event.target.value)}>
              <option value="">Todos</option>
              {activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
          <label>
            De
            <input value={reportFilters.dateFrom} onChange={(event) => updateReportFilter('dateFrom', event.target.value)} type="date" />
          </label>
          <label>
            Até
            <input value={reportFilters.dateTo} onChange={(event) => updateReportFilter('dateTo', event.target.value)} type="date" />
          </label>
          <div className="actions filter-actions">
            <button className="btn small" type="submit">Filtrar</button>
            <button className="btn secondary small" type="button" onClick={() => void clearReportFilters()}>Limpar</button>
          </div>
        </form>

        {!reportRows.length ? (
          <div className="card empty-state">
            <h3>Sem dados para o relatório</h3>
            <p className="muted">Lance transações categorizadas para visualizar totais por categoria.</p>
          </div>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Perfil</th>
                  <th>Receitas</th>
                  <th>Despesas</th>
                  <th>Líquido</th>
                  <th>Lançamentos</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={`${row.financialProfileId}-${row.currencyCode}-${row.categoryId ?? row.categoryName}`}>
                    <td>{row.parentName ? `${row.parentName} > ${row.categoryName}` : row.categoryName}</td>
                    <td>{row.financialProfileName}</td>
                    <td>{formatMoney(row.income, row.currencyCode)}</td>
                    <td>{formatMoney(row.expense, row.currencyCode)}</td>
                    <td>{formatMoney(row.net, row.currencyCode)}</td>
                    <td>{row.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="category-form-title">
            <div className="modal-header">
              <div>
                <h2 id="category-form-title">{isEditing ? 'Editar categoria' : 'Adicionar categoria'}</h2>
                <p className="muted">Use categorias principais e subcategorias por perfil para organizar receitas e despesas.</p>
              </div>
              <button className="btn secondary small" type="button" onClick={cancelForm} disabled={isSubmitting} aria-label="Fechar formulário de categoria">Fechar</button>
            </div>

            {error && <p className="alert">{error}</p>}

            <form className="form-grid" onSubmit={saveCategory}>
              <label>
                Perfil financeiro
                <select value={formState.financialProfileId} onChange={(event) => updateFormField('financialProfileId', event.target.value)} disabled={isSubmitting}>
                  <option value="">Global para todos os perfis</option>
                  {activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profileTypeLabel(profile.type)}</option>)}
                </select>
              </label>

              <label>
                Categoria principal
                <select value={formState.parentId} onChange={(event) => updateFormField('parentId', event.target.value)} disabled={isSubmitting}>
                  <option value="">Nenhuma, será categoria principal</option>
                  {rootCategoryOptions
                    .filter((category) => category.id !== formState.id)
                    .map((category) => <option key={category.id} value={category.id}>{categoryFullName(category)}</option>)}
                </select>
              </label>

              <label className="full-width">
                Nome
                <input value={formState.name} onChange={(event) => updateFormField('name', event.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Saúde, Supermercado, IVA" required disabled={isSubmitting} autoFocus />
              </label>

              <div className="actions full-width">
                <button className="btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar categoria'}</button>
                <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Cancelar</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
