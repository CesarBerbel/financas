import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccountType, FinancialProfileType, TransactionType } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

type AuthContext = {
  accessToken: string;
  user: { id: string; email: string; name: string };
};

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`;
}

describe('Release 1 API e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { endsWith: '@example.test' } } });
    await seedCurrencies();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@example.test' } } });
    await app.close();
  });

  async function seedCurrencies() {
    await prisma.currency.upsert({ where: { code: 'BRL' }, update: {}, create: { code: 'BRL', name: 'Real brasileiro', symbol: 'R$' } });
    await prisma.currency.upsert({ where: { code: 'EUR' }, update: {}, create: { code: 'EUR', name: 'Euro', symbol: '€' } });
    await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', name: 'Dólar americano', symbol: '$' } });
  }

  async function registerUser(prefix = 'qa'): Promise<AuthContext> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: `QA ${prefix}`, email: uniqueEmail(prefix), password: 'SenhaTeste123!' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toContain('@example.test');
    return response.body;
  }

  async function getProfile(token: string, type: FinancialProfileType) {
    const response = await request(app.getHttpServer())
      .get('/api/financial-profiles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const profile = response.body.find((item: { type: FinancialProfileType }) => item.type === type);
    expect(profile).toBeTruthy();
    return profile;
  }

  it('blocks protected endpoints without authentication', async () => {
    await request(app.getHttpServer()).get('/api/financial-profiles').expect(401);
    await request(app.getHttpServer()).get('/api/accounts').expect(401);
    await request(app.getHttpServer()).get('/api/transactions').expect(401);
    await request(app.getHttpServer()).get('/api/categories').expect(401);
  });

  it('registers a user with the default release 1 financial profiles', async () => {
    const auth = await registerUser('profiles');

    const response = await request(app.getHttpServer())
      .get('/api/financial-profiles')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Pessoal Brasil', type: FinancialProfileType.PERSONAL_BRAZIL, baseCurrency: 'BRL' }),
      expect.objectContaining({ name: 'Pessoal Portugal', type: FinancialProfileType.PERSONAL_PORTUGAL, baseCurrency: 'EUR' }),
      expect.objectContaining({ name: 'Empresa Portugal', type: FinancialProfileType.BUSINESS_PORTUGAL, baseCurrency: 'EUR' }),
      expect.objectContaining({ name: 'Empresa USA', type: FinancialProfileType.BUSINESS_USA, baseCurrency: 'USD' }),
    ]));
  });

  it('keeps accounts isolated between authenticated users', async () => {
    const userA = await registerUser('owner');
    const userB = await registerUser('intruder');
    const profileA = await getProfile(userA.accessToken, FinancialProfileType.PERSONAL_PORTUGAL);

    const accountResponse = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ financialProfileId: profileA.id, name: 'Conta isolada QA', type: AccountType.CHECKING, currencyCode: 'EUR', initialBalance: '0.00' })
      .expect(201);

    const intruderList = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);

    expect(intruderList.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: accountResponse.body.id })]));

    await request(app.getHttpServer())
      .patch(`/api/accounts/${accountResponse.body.id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ name: 'Tentativa indevida' })
      .expect(404);
  });

  it('covers the release 1 critical flow: account, category, transaction, summary and report', async () => {
    const auth = await registerUser('flow');
    const profile = await getProfile(auth.accessToken, FinancialProfileType.PERSONAL_PORTUGAL);

    const account = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ financialProfileId: profile.id, name: 'Conta principal QA', type: AccountType.CHECKING, currencyCode: 'EUR', initialBalance: '10.00' })
      .expect(201)
      .then((response) => response.body);

    const category = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ financialProfileId: profile.id, name: 'Consultoria QA' })
      .expect(201)
      .then((response) => response.body);

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        financialProfileId: profile.id,
        accountId: account.id,
        categoryId: category.id,
        type: TransactionType.INCOME,
        amount: '125.50',
        occurredAt: '2026-06-25',
        description: 'Receita QA',
        tags: ['release-1', 'smoke'],
      })
      .expect(201);

    const transactions = await request(app.getHttpServer())
      .get(`/api/transactions?categoryId=${category.id}&tag=smoke`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(transactions.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ description: 'Receita QA', categoryId: category.id, categoryName: 'Consultoria QA' }),
    ]));
    expect(transactions.body[0].tags.map((item: { tag: { name: string } }) => item.tag.name)).toContain('smoke');

    const summary = await request(app.getHttpServer())
      .get('/api/accounts/summary')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(summary.body.byCurrency).toEqual(expect.arrayContaining([expect.objectContaining({ currencyCode: 'EUR', balance: '135.50' })]));

    const report = await request(app.getHttpServer())
      .get(`/api/categories/report?financialProfileId=${profile.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(report.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryId: category.id, categoryName: 'Consultoria QA', income: '125.50', expense: '0.00', net: '125.50' }),
    ]));

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/categories/${category.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(409);

    expect(deleteResponse.body.message).toContain('Categoria em uso por transações não pode ser removida');
  });

  it('rejects invalid payloads before persisting financial data', async () => {
    const auth = await registerUser('validation');

    await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Sem perfil', type: AccountType.CHECKING, currencyCode: 'EUR' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ amount: '-10.00', description: 'Inválida' })
      .expect(400);
  });
});
