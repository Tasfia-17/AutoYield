import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { vaultRouter } from './routes/vault.js';
import { userRouter } from './routes/user.js';
import { gasRouter } from './routes/gas.js';
import { chatRouter } from './routes/chat.js';
import { setupQueues } from './jobs/queues.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// ── Security middleware ──
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ──
app.use('/api/vault', vaultRouter);
app.use('/api/user', userRouter);
app.use('/api/gas', gasRouter);
app.use('/api/chat', chatRouter);

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Start ──
setupQueues();
app.listen(PORT, () => logger.info(`Backend API listening on :${PORT}`));
