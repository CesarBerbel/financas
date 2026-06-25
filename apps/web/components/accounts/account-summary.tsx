'use client';

import { useEffect, useState } from 'react';
import { authApi, getApiErrorMessage } from '../../lib/api';

type Summary = {
  accountCount: number;
  byCurrency: { currencyCode: string; balance: string }[];
};

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
}

export function AccountSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi('/accounts/summary')
      .then((result) => setSummary(result as Summary))
      .catch((error) => setError(`Não foi possível carregar o resumo de saldos. ${getApiErrorMessage(error, 'Verifique se a API está rodando e se a migration da Fase 1 foi aplicada.')}`));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!summary) return <p className="card muted">Carregando dashboard financeiro...</p>;

  return (
    <section className="stack" aria-labelledby="summary-title">
      <h2 id="summary-title">Resumo de saldos</h2>
      <div className="grid">
        <article className="card">
          <p className="muted">Contas cadastradas</p>
          <strong className="metric">{summary.accountCount}</strong>
        </article>

        {summary.byCurrency.length ? summary.byCurrency.map((item) => (
          <article className="card" key={item.currencyCode}>
            <p className="muted">Saldo consolidado em {item.currencyCode}</p>
            <strong className="metric">{formatMoney(item.balance, item.currencyCode)}</strong>
          </article>
        )) : (
          <article className="card">
            <p className="muted">Saldo consolidado</p>
            <strong className="metric">Sem contas</strong>
          </article>
        )}
      </div>
    </section>
  );
}
