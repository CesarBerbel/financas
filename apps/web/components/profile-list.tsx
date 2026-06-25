'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, getApiErrorMessage, isUnauthorized } from '../lib/api';

type Profile = { id: string; name: string; type: string; baseCurrency: string; status: string };

type ProfileFormState = {
  id?: string;
  name: string;
  type: string;
  baseCurrency: string;
};

type ScreenMode = 'list' | 'create' | 'edit';

const profileTypes = [
  { value: 'PERSONAL_BRAZIL', label: 'Pessoal Brasil' },
  { value: 'PERSONAL_PORTUGAL', label: 'Pessoal Portugal' },
  { value: 'BUSINESS_PORTUGAL', label: 'Empresarial Portugal' },
  { value: 'BUSINESS_USA', label: 'Empresarial USA' },
];

const currencies = [
  { value: 'BRL', label: 'BRL - Real brasileiro' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'USD', label: 'USD - Dólar americano' },
];

const emptyForm: ProfileFormState = {
  name: '',
  type: 'PERSONAL_PORTUGAL',
  baseCurrency: 'EUR',
};

const defaultCurrencyByProfileType: Record<string, string> = {
  PERSONAL_BRAZIL: 'BRL',
  PERSONAL_PORTUGAL: 'EUR',
  BUSINESS_PORTUGAL: 'EUR',
  BUSINESS_USA: 'USD',
};

function profileTypeLabel(type: string) {
  return profileTypes.find((item) => item.value === type)?.label ?? type;
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? 'Ativo' : 'Arquivado';
}

export function ProfileList() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [formState, setFormState] = useState<ProfileFormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.status === 'ACTIVE'), [profiles]);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await authApi('/financial-profiles');
      setProfiles(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(
        isUnauthorized(error)
          ? 'Sessão expirada. Entre novamente para carregar seus perfis.'
          : `Não foi possível carregar seus perfis. ${getApiErrorMessage(error, 'Verifique se a API está rodando.')}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function openCreateForm() {
    setSuccess('');
    setError('');
    setFormState(emptyForm);
    setMode('create');
  }

  function openEditForm(profile: Profile) {
    setSuccess('');
    setError('');
    setFormState({ id: profile.id, name: profile.name, type: profile.type, baseCurrency: profile.baseCurrency });
    setMode('edit');
  }

  function cancelForm() {
    setFormState(emptyForm);
    setMode('list');
  }

  function updateProfileType(type: string) {
    setFormState((current) => ({
      ...current,
      type,
      baseCurrency: defaultCurrencyByProfileType[type] ?? current.baseCurrency,
    }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const payload = {
      name: formState.name.trim(),
      type: formState.type,
      baseCurrency: formState.baseCurrency,
    };

    try {
      if (mode === 'edit' && formState.id) {
        await authApi(`/financial-profiles/${formState.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setSuccess('Perfil financeiro atualizado com sucesso.');
      } else {
        await authApi('/financial-profiles', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Perfil financeiro criado com sucesso. Ele já está disponível no cadastro de contas.');
      }
      setMode('list');
      setFormState(emptyForm);
      await loadProfiles();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Verifique os campos e tente novamente.');
      setError(mode === 'edit' ? `Não foi possível editar o perfil. ${message}` : `Não foi possível criar o perfil. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveProfile(profileId: string) {
    setError('');
    setSuccess('');
    try {
      await authApi(`/financial-profiles/${profileId}/archive`, { method: 'POST' });
      setSuccess('Perfil financeiro arquivado.');
      await loadProfiles();
    } catch (error) {
      setError(`Não foi possível arquivar o perfil. ${getApiErrorMessage(error, 'Feche as contas vinculadas antes de arquivar.')}`);
    }
  }

  if (isLoading) return <p className="card muted">Carregando perfis financeiros...</p>;

  if (mode !== 'list') {
    const isEditing = mode === 'edit';

    return (
      <section className="stack" aria-labelledby="profile-form-title">
        <div className="page-header">
          <div>
            <h2 id="profile-form-title">{isEditing ? 'Editar perfil financeiro' : 'Adicionar perfil financeiro'}</h2>
            <p className="muted">Defina o nome, o tipo e a moeda base do perfil. Perfis ativos aparecem no cadastro de contas.</p>
          </div>
          <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Voltar para lista</button>
        </div>

        {error && <p className="alert">{error}</p>}

        <form className="card form-grid" onSubmit={saveProfile}>
          <label>
            Nome do perfil
            <input
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              minLength={2}
              placeholder="Ex.: Pessoal Brasil"
              required
              disabled={isSubmitting}
            />
          </label>
          <label>
            Tipo
            <select
              value={formState.type}
              onChange={(event) => updateProfileType(event.target.value)}
              required
              disabled={isSubmitting}
            >
              {profileTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>
            Moeda base
            <select
              value={formState.baseCurrency}
              onChange={(event) => setFormState((current) => ({ ...current, baseCurrency: event.target.value }))}
              required
              disabled={isSubmitting}
            >
              {currencies.map((currency) => <option key={currency.value} value={currency.value}>{currency.label}</option>)}
            </select>
          </label>
          <div className="actions full-width">
            <button className="btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar perfil'}</button>
            <button className="btn secondary" type="button" onClick={cancelForm} disabled={isSubmitting}>Cancelar</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="stack" aria-labelledby="profiles-title">
      <div className="page-header">
        <div>
          <h2 id="profiles-title">Gerenciar perfis</h2>
          <p className="muted">Crie, edite e organize perfis em BRL, EUR ou USD para manter contextos financeiros separados.</p>
        </div>
        <button className="btn" type="button" onClick={openCreateForm}>Adicionar perfil</button>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      <div className="card">
        <strong>{activeProfiles.length}</strong> perfil(is) ativo(s). Perfis ativos são carregados no cadastro de contas.
      </div>

      {!profiles.length ? (
        <div className="card empty-state">
          <h3>Nenhum perfil cadastrado</h3>
          <p className="muted">Clique em “Adicionar perfil” para liberar o cadastro de contas.</p>
          <button className="btn" type="button" onClick={openCreateForm}>Adicionar primeiro perfil</button>
        </div>
      ) : (
        <div className="card-list" aria-label="Lista de perfis financeiros">
          {profiles.map((profile) => (
            <article className="card entity-card" key={profile.id}>
              <div className="entity-card-main">
                <div>
                  <h3>{profile.name}</h3>
                  <p className="muted">{profileTypeLabel(profile.type)}</p>
                </div>
                <span className="badge">{statusLabel(profile.status)}</span>
              </div>

              <div className="entity-card-details">
                <p><span className="muted">Moeda base</span><strong>{profile.baseCurrency}</strong></p>
                <p><span className="muted">Status</span><strong>{statusLabel(profile.status)}</strong></p>
              </div>

              <div className="actions">
                <button className="btn secondary small" type="button" onClick={() => openEditForm(profile)}>Editar</button>
                {profile.status === 'ACTIVE' && <button className="btn danger small" type="button" onClick={() => void archiveProfile(profile.id)}>Arquivar</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
