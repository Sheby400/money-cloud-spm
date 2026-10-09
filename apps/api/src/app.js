import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { listTransactions, createTransaction, deleteTransaction } from './store.js';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(40),
  amountCents: z.number().int().positive().max(100000000),
}).strict();

export const app = express();
app.disable('x-powered-by');
app.use(helmet());

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen CORS no permitido'));
  },
}));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'moneycloud-api' });
});

app.get('/api/v1/transactions', async (_request, response, next) => {
  try {
    response.json({ data: await listTransactions() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/transactions', async (request, response, next) => {
  try {
    const parsed = transactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: 'Datos inválidos',
        details: parsed.error.flatten(),
      });
    }
    return response.status(201).json({ data: await createTransaction(parsed.data) });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/v1/transactions/:id', async (request, response, next) => {
  try {
    const deleted = await deleteTransaction(request.params.id);
    if (!deleted) return response.status(404).json({ error: 'Movimiento no encontrado' });
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.get('/api/v1/summary', async (_request, response, next) => {
  try {
    const transactions = await listTransactions();
    const incomeCents = transactions
      .filter((item) => item.type === 'income')
      .reduce((total, item) => total + item.amountCents, 0);
    const expenseCents = transactions
      .filter((item) => item.type === 'expense')
      .reduce((total, item) => total + item.amountCents, 0);

    response.json({
      data: {
        incomeCents,
        expenseCents,
        balanceCents: incomeCents - expenseCents,
        count: transactions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error('API error:', error.message);
  const status = error.message === 'Origen CORS no permitido' ? 403 : 500;
  response.status(status).json({ error: 'No fue posible completar la operación' });
});