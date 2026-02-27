require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { connectDB } = require('./config/db');
const { startCronJobs } = require('./utils/cron');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const projectRoutes = require('./routes/projects');
const reportRoutes  = require('./routes/reports');
const emailRoutes   = require('./routes/email');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware ──────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting ────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts' }));
app.use('/api',      rateLimit({ windowMs: 60 * 1000,      max: 300 }));

// ── Body parsing ─────────────────────────────────────
app.use(express.json());

// ── Routes ───────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/email',    emailRoutes);

// ── Health check ─────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── 404 handler ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start ────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RAG Tracker API running on http://localhost:${PORT}`);
    startCronJobs();
  });
});
