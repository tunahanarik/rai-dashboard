import { URL } from 'node:url';

const REST_URL = process.env.REST_URL || 'http://127.0.0.1:43317';

function validateRestUrl() {
  const u = new URL(REST_URL);
  // Security: only allow localhost REST endpoint to avoid SSRF.
  if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
    throw new Error(`SECURITY: REST_URL must be localhost. Got: ${u.hostname}`);
  }
}
validateRestUrl();

async function getJson<T>(path: string): Promise<T> {
  const url = new URL(path, REST_URL);
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`REST ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function restWalletBalances(address: string) {
  return getJson<{ balances: Array<{ denom: string; amount: string }> }>(
    `/cosmos/bank/v1beta1/balances/${address}`
  );
}

export async function restDelegation(address: string, valoper: string) {
  return getJson<any>(
    `/cosmos/staking/v1beta1/validators/${valoper}/delegations/${address}`
  );
}
