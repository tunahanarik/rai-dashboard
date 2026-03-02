import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ─── Configuration ────────────────────────────────────────────────────────────

const RPC_NODE_URL = process.env.RPC_NODE_URL || 'tcp://127.0.0.1:43657';
const CHAIN_ID = process.env.CHAIN_ID || 'raitestnet_77701-1';
const CLI_BINARY = 'republicd';
const CLI_TIMEOUT_MS = 15_000;

// ─── Input Validation ─────────────────────────────────────────────────────────

/**
 * Validate a Republic bech32 wallet address.
 * Must start with "rai1" and be between 39–59 characters (bech32 standard).
 */
export function validateWalletAddress(address: string): boolean {
    return /^rai1[a-z0-9]{38,58}$/.test(address);
}

/**
 * Validate a Republic validator operator address.
 * Must start with "raivaloper1".
 */
export function validateValoperAddress(address: string): boolean {
    return /^raivaloper1[a-z0-9]{38,58}$/.test(address);
}

// ─── Safe CLI Wrapper ─────────────────────────────────────────────────────────

interface CliResult {
    stdout: string;
    parsed: Record<string, unknown>;
}

/**
 * Execute a `republicd query` command safely using execFile (not shell).
 *
 * Security notes:
 * - Uses execFile (no shell interpolation).
 * - Only allows pre-defined query subcommands.
 * - All arguments are passed as array elements (no concatenation).
 * - Timeout enforced to prevent hanging.
 */
async function safeExec(args: string[]): Promise<CliResult> {
    try {
        const { stdout } = await execFileAsync(CLI_BINARY, args, {
            timeout: CLI_TIMEOUT_MS,
            maxBuffer: 1024 * 512, // 512 KB
            env: {
                // Minimal environment — don't leak host env
                PATH: process.env.PATH,
                HOME: process.env.HOME,
            },
        });

        let parsed: Record<string, unknown> = {};
        try {
            parsed = JSON.parse(stdout);
        } catch {
            // Some responses may not be valid JSON
            parsed = { raw: stdout.trim() };
        }

        return { stdout: stdout.trim(), parsed };
    } catch (err: unknown) {
        const error = err as Error & { code?: string; killed?: boolean };
        if (error.killed) {
            throw new Error(`CLI command timed out after ${CLI_TIMEOUT_MS}ms`);
        }
        throw new Error(`CLI command failed: ${error.message}`);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WalletBalance {
    balance_arai: string;
    balance_rai: string;
    raw: Record<string, unknown>;
}

export interface DelegationInfo {
    delegator_address: string;
    validator_address: string;
    shares: string;
    balance_arai: string;
    balance_rai: string;
    raw: Record<string, unknown>;
}

/**
 * Query bank balances for a wallet address.
 */
export async function getWalletBalance(address: string): Promise<WalletBalance> {
    if (!validateWalletAddress(address)) {
        throw new Error('Invalid wallet address format');
    }

    const result = await safeExec([
        'query', 'bank', 'balances', address,
        '--node', RPC_NODE_URL,
        '--chain-id', CHAIN_ID,
        '-o', 'json',
    ]);

    // Parse arai balance
    const balances = (result.parsed as any).balances as Array<{ denom: string; amount: string }> | undefined;
    const araiEntry = balances?.find((b) => b.denom === 'arai');
    const araiAmount = araiEntry?.amount ?? '0';

    // Convert arai to RAI (1 RAI = 10^18 arai)
    const raiAmount = (BigInt(araiAmount) / BigInt(10 ** 18)).toString();
    const remainder = (BigInt(araiAmount) % BigInt(10 ** 18)).toString().padStart(18, '0');
    const balanceRai = `${raiAmount}.${remainder.replace(/0+$/, '') || '0'}`;

    return {
        balance_arai: araiAmount,
        balance_rai: balanceRai,
        raw: result.parsed,
    };
}

/**
 * Query staking delegation for a specific validator.
 */
export async function getDelegation(
    address: string,
    valoper: string
): Promise<DelegationInfo> {
    if (!validateWalletAddress(address)) {
        throw new Error('Invalid wallet address format');
    }
    if (!validateValoperAddress(valoper)) {
        throw new Error('Invalid validator operator address format');
    }

    const result = await safeExec([
        'query', 'staking', 'delegation', address, valoper,
        '--node', RPC_NODE_URL,
        '--chain-id', CHAIN_ID,
        '-o', 'json',
    ]);

    const delegation = (result.parsed as any).delegation ?? {};
    const balance = (result.parsed as any).balance ?? {};

    const araiAmount = balance.amount ?? '0';
    const raiAmount = (BigInt(araiAmount) / BigInt(10 ** 18)).toString();
    const remainder = (BigInt(araiAmount) % BigInt(10 ** 18)).toString().padStart(18, '0');
    const balanceRai = `${raiAmount}.${remainder.replace(/0+$/, '') || '0'}`;

    return {
        delegator_address: delegation.delegator_address ?? address,
        validator_address: delegation.validator_address ?? valoper,
        shares: delegation.shares ?? '0',
        balance_arai: araiAmount,
        balance_rai: balanceRai,
        raw: result.parsed,
    };
}
