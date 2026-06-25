import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionManager } from '../components/transactions/transaction-manager';
import { authApi } from '../lib/api';

vi.mock('../lib/api', () => ({
  authApi: vi.fn(),
  getApiErrorMessage: vi.fn((error: unknown, fallback: string) => error instanceof Error ? error.message : fallback),
  isUnauthorized: vi.fn(() => false),
}));

const mockAuthApi = vi.mocked(authApi);

const profile = { id: 'profile-1', name: 'Pessoal Portugal', type: 'PERSONAL_PORTUGAL', baseCurrency: 'EUR', status: 'ACTIVE' };
const account = { id: 'account-1', financialProfileId: 'profile-1', name: 'Conta principal', currencyCode: 'EUR', status: 'ACTIVE' };
const baseCategory = { id: 'category-1', financialProfileId: 'profile-1', parentId: null, name: 'Alimentação', fullName: 'Alimentação', financialProfile: profile, parent: null };
const transaction = {
  id: 'transaction-1',
  financialProfileId: 'profile-1',
  accountId: 'account-1',
  type: 'EXPENSE',
  amount: '10.00',
  currencyCode: 'EUR',
  description: 'Mercado',
  occurredAt: '2026-06-20',
  financialProfile: profile,
  account,
  category: null,
  tags: [],
};

function mockDefaultApiResponses() {
  let categories = [baseCategory];
  mockAuthApi.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/financial-profiles') return [profile];
    if (path === '/accounts') return [account];
    if (path === '/categories' && !options?.method) return categories;
    if (path === '/transactions') return [transaction];
    if (path === '/categories' && options?.method === 'POST') {
      const created = { ...baseCategory, id: 'category-2', name: 'Saúde', fullName: 'Saúde' };
      categories = [...categories, created];
      return created;
    }
    return [];
  });
}

describe('TransactionManager modal behavior', () => {
  beforeEach(() => {
    mockAuthApi.mockReset();
    mockDefaultApiResponses();
    window.localStorage.setItem('financas_token', 'token-test');
  });

  it('opens transaction creation in a modal and no longer renders the old category management shortcut', async () => {
    const user = userEvent.setup();
    render(<TransactionManager />);

    await screen.findByRole('heading', { name: 'Transações financeiras' });
    expect(screen.queryByText('Gerir categorias')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar transação' }));

    const dialog = screen.getByRole('dialog', { name: 'Adicionar transação' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '+ nova categoria' })).toBeInTheDocument();
  });

  it('opens inline category creation in a stacked modal from the transaction form', async () => {
    const user = userEvent.setup();
    render(<TransactionManager />);

    await screen.findByRole('heading', { name: 'Transações financeiras' });
    await user.click(screen.getByRole('button', { name: 'Adicionar transação' }));
    await user.click(screen.getByRole('button', { name: '+ nova categoria' }));

    expect(screen.getByRole('dialog', { name: 'Adicionar transação' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nova categoria' })).toBeInTheDocument();
  });

  it('creates an inline category, reloads categories and selects the created category', async () => {
    const user = userEvent.setup();
    render(<TransactionManager />);

    await screen.findByRole('heading', { name: 'Transações financeiras' });
    await user.click(screen.getByRole('button', { name: 'Adicionar transação' }));
    await user.click(screen.getByRole('button', { name: '+ nova categoria' }));

    const inlineDialog = screen.getByRole('dialog', { name: 'Nova categoria' });
    await user.type(within(inlineDialog).getByLabelText('Nome'), 'Saúde');
    await user.click(within(inlineDialog).getByRole('button', { name: 'Criar e selecionar' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nova categoria' })).not.toBeInTheDocument());
    expect(screen.getByText('Categoria "Saúde" criada e selecionada na transação.')).toBeInTheDocument();
    expect(mockAuthApi).toHaveBeenCalledWith('/categories', expect.objectContaining({ method: 'POST' }));
  });
});
