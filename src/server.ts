import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import apiRouter from './api';

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1'; // Security: bind to localhost only

const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : false; // false = same-origin only

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Compression
app.use(compression());

// CORS
app.use(
    cors({
        origin: CORS_ORIGINS,
        methods: ['GET'],
        allowedHeaders: ['Content-Type'],
    })
);

// Rate limiting
app.use(
    rateLimit({
        windowMs: RATE_LIMIT_WINDOW_MS,
        max: RATE_LIMIT_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        message: { ok: false, error: 'Too many requests, please try again later.' },
    })
);

// Body parser with strict size limit (8kb)
app.use(express.json({ limit: '8kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

// ─── Static Frontend ──────────────────────────────────────────────────────────

const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir, { maxAge: '1h' }));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[SERVER] Unhandled error:', err.message);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  RAI Dashboard v1.0.0                                ║
║  Listening on http://${HOST}:${PORT}                 ║
║  Security: helmet + CORS + rate-limit + body-limit   ║
╚══════════════════════════════════════════════════════╝
  `);
});

export default app;
