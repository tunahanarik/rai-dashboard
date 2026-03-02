import fetch from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

// ─── Configuration ────────────────────────────────────────────────────────────

const RPC_HTTP_URL = process.env.RPC_HTTP_URL || 'http://127.0.0.1:43657';

// Validate the configured RPC URL at startup (SSRF prevention)
function validateRpcUrl(url: string): void {
    const parsed = new URL(url);
    const allowedHosts = ['127.0.0.1', 'localhost', '::1'];
    if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(
            `SECURITY: RPC_HTTP_URL must point to localhost. Got: ${parsed.hostname}`
        );
    }
}

validateRpcUrl(RPC_HTTP_URL);

// ─── HTTP Fetch Helper ────────────────────────────────────────────────────────

interface RpcResponse {
    result: Record<string, unknown>;
}

/**
 * Fetch JSON from the local RPC endpoint.
 * Only the pre-configured URL is used — never user-supplied URLs.
 */
async function fetchRpc(path: string): Promise<Record<string, unknown>> {
    const url = `${RPC_HTTP_URL}${path}`;

    // Double-check at runtime
    validateRpcUrl(url);

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : fetch;

        const req = lib.get(url, { timeout: 10_000 }, (res) => {
            let data = '';

            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                reject(new Error(`RPC returned status ${res.statusCode}`));
                return;
            }

            res.on('data', (chunk: string) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data) as RpcResponse;
                    resolve(parsed.result ?? parsed as unknown as Record<string, unknown>);
                } catch (err) {
                    reject(new Error(`Failed to parse RPC response: ${(err as Error).message}`));
                }
            });
        });

        req.on('error', (err: Error) => {
            reject(new Error(`RPC request failed: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('RPC request timed out (10s)'));
        });
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NodeStatus {
    latest_block_height: string;
    latest_block_time: string;
    catching_up: boolean;
}

export interface PeerInfo {
    n_peers: number;
    listening: boolean;
}

/**
 * GET /status → extract sync_info
 */
export async function getNodeStatus(): Promise<NodeStatus> {
    const result = await fetchRpc('/status');
    const syncInfo = (result as any).sync_info;
    if (!syncInfo) {
        throw new Error('Unexpected RPC response: missing sync_info');
    }
    return {
        latest_block_height: syncInfo.latest_block_height,
        latest_block_time: syncInfo.latest_block_time,
        catching_up: syncInfo.catching_up,
    };
}

/**
 * GET /net_info → extract peer count
 */
export async function getPeerInfo(): Promise<PeerInfo> {
    const result = await fetchRpc('/net_info');
    return {
        n_peers: parseInt((result as any).n_peers ?? '0', 10),
        listening: (result as any).listening ?? false,
    };
}
