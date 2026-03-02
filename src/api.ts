import { Router, Request, Response } from 'express';
import { getNodeStatus, getPeerInfo } from './rpc';
import { validateWalletAddress, validateValoperAddress } from './cli';
import { restWalletBalances, restDelegation } from './rest';

const router = Router();

// ─── Node Status ──────────────────────────────────────────────────────────────

router.get('/healthz', (_req: Request, res: Response) => {
    // Health endpoint for CI/smoke tests. Does not require RPC.
    res.json({ ok: true });
});

router.get('/node/status', async (_req: Request, res: Response) => {
    try {
        const status = await getNodeStatus();
        res.json({ ok: true, data: status });
    } catch (err) {
        console.error('[API] /node/status error:', (err as Error).message);
        res.status(502).json({ ok: false, error: 'Failed to fetch node status' });
    }
});

// ─── Peer Info ────────────────────────────────────────────────────────────────

router.get('/node/peers', async (_req: Request, res: Response) => {
    try {
        const peers = await getPeerInfo();
        res.json({ ok: true, data: peers });
    } catch (err) {
        console.error('[API] /node/peers error:', (err as Error).message);
        res.status(502).json({ ok: false, error: 'Failed to fetch peer info' });
    }
});

// ─── Wallet Balance ───────────────────────────────────────────────────────────

router.get('/wallet/:address/balance', async (req: Request, res: Response) => {
    const address = String((req.params as any).address ?? '');

    if (!validateWalletAddress(address)) {
        res.status(400).json({
            ok: false,
            error: 'Invalid wallet address. Must start with "rai1" and be 39–59 characters.',
        });
        return;
    }

    try {
        const j = await restWalletBalances(address);
        const arai = (j.balances || []).find((b) => b.denom === 'arai')?.amount ?? '0';
        const raiWhole = (BigInt(arai) / BigInt(10 ** 18)).toString();
        const rem = (BigInt(arai) % BigInt(10 ** 18)).toString().padStart(18, '0');
        const rai = `${raiWhole}.${rem.replace(/0+$/, '') || '0'}`;
        res.json({ ok: true, data: { balance_arai: arai, balance_rai: rai, raw: j } });
    } catch (err) {
        console.error('[API] /wallet/balance error:', (err as Error).message);
        res.status(502).json({ ok: false, error: 'Failed to fetch wallet balance' });
    }
});

// ─── Delegation ───────────────────────────────────────────────────────────────

router.get('/wallet/:address/delegation/:valoper', async (req: Request, res: Response) => {
    const address = String((req.params as any).address ?? '');
    const valoper = String((req.params as any).valoper ?? '');

    if (!validateWalletAddress(address)) {
        res.status(400).json({
            ok: false,
            error: 'Invalid wallet address. Must start with "rai1" and be 39–59 characters.',
        });
        return;
    }

    if (!validateValoperAddress(valoper)) {
        res.status(400).json({
            ok: false,
            error: 'Invalid validator operator address. Must start with "raivaloper1".',
        });
        return;
    }

    try {
        const j = await restDelegation(address, valoper);
        const bal = j?.delegation_response?.balance;
        const arai = bal?.denom === 'arai' ? (bal.amount ?? '0') : (bal?.amount ?? '0');
        const raiWhole = (BigInt(arai) / BigInt(10 ** 18)).toString();
        const rem = (BigInt(arai) % BigInt(10 ** 18)).toString().padStart(18, '0');
        const rai = `${raiWhole}.${rem.replace(/0+$/, '') || '0'}`;
        const del = j?.delegation_response?.delegation || {};
        res.json({
            ok: true,
            data: {
                delegator_address: del.delegator_address ?? address,
                validator_address: del.validator_address ?? valoper,
                shares: del.shares ?? '0',
                balance_arai: arai,
                balance_rai: rai,
                raw: j,
            },
        });
    } catch (err) {
        console.error('[API] /wallet/delegation error:', (err as Error).message);
        res.status(502).json({ ok: false, error: 'Failed to fetch delegation info' });
    }
});

export default router;
