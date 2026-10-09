import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { resetMemoryForTests } from '../src/store.js';

process.env.STORAGE_DRIVER = 'memory';
beforeEach(() => resetMemoryForTests());

describe('API MoneyCloud', () => {
  it('responde health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('crea, lista, resume y elimina movimientos', async () => {
    const created = await request(app)
      .post('/api/v1/transactions')
      .send({ type: 'income', description: 'Beca', category: 'Otros', amountCents: 12345 });
    expect(created.status).toBe(201);

    const id = created.body.data.id;
    const list = await request(app).get('/api/v1/transactions');
    expect(list.body.data).toHaveLength(1);

    const summary = await request(app).get('/api/v1/summary');
    expect(summary.body.data.balanceCents).toBe(12345);

    const deleted = await request(app).delete(`/api/v1/transactions/${id}`);
    expect(deleted.status).toBe(204);
  });

  it('rechaza monto inválido', async () => {
    const response = await request(app)
      .post('/api/v1/transactions')
      .send({ type: 'expense', description: 'Café', category: 'Comida', amountCents: -5 });
    expect(response.status).toBe(400);
  });
});