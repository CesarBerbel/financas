'use client';
import { useEffect, useState } from 'react';

type Profile = { id: string; name: string; type: string; baseCurrency: string; status: string };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function ProfileList() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('financas_token');
    fetch(`${API_URL}/financial-profiles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setProfiles)
      .catch(() => setError('Entre novamente para carregar seus perfis.'));
  }, []);
  if (error) return <p className="alert">{error}</p>;
  if (!profiles.length) return <p className="card muted">Nenhum perfil carregado.</p>;
  return <div className="grid">{profiles.map((profile) => <article className="card" key={profile.id}><h2>{profile.name}</h2><p className="muted">{profile.type}</p><strong>{profile.baseCurrency}</strong><p>Status: {profile.status}</p></article>)}</div>;
}
