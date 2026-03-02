/**
 * RAI Dashboard — Frontend Application
 *
 * Read-only dashboard for Republic/RAI network monitoring.
 * All data is fetched from the backend API proxy (no direct RPC access).
 */

; (function () {
    'use strict';

    // ─── Configuration ────────────────────────────────────────────────────────
    const API_BASE = '/api';
    const AUTO_REFRESH_INTERVAL = 30; // seconds
    const WALLET_ADDRESS_REGEX = /^rai1[a-z0-9]{38,58}$/;
    const VALOPER_ADDRESS_REGEX = /^raivaloper1[a-z0-9]{38,58}$/;

    // ─── DOM Elements ─────────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    const els = {
        statusDot: $('statusDot'),
        statusText: $('statusText'),
        refreshCountdown: $('refreshCountdown'),
        lastUpdate: $('lastUpdate'),
        blockHeight: $('blockHeight'),
        blockTime: $('blockTime'),
        peerCount: $('peerCount'),
        syncStatus: $('syncStatus'),
        walletForm: $('walletForm'),
        walletAddress: $('walletAddress'),
        valoperAddress: $('valoperAddress'),
        queryBtn: $('queryBtn'),
        clearBtn: $('clearBtn'),
        walletResults: $('walletResults'),
        resultsGrid: $('resultsGrid'),
        errorToast: $('errorToast'),
    };

    // ─── State ────────────────────────────────────────────────────────────────
    let countdown = AUTO_REFRESH_INTERVAL;
    let countdownTimer = null;
    let isQuerying = false;

    // ─── API Helpers ──────────────────────────────────────────────────────────

    async function apiFetch(path) {
        const response = await fetch(`${API_BASE}${path}`);
        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'API request failed');
        }
        return data.data;
    }

    // ─── Node Status ─────────────────────────────────────────────────────────

    async function refreshNodeStatus() {
        try {
            const [status, peers] = await Promise.all([
                apiFetch('/node/status'),
                apiFetch('/node/peers'),
            ]);

            // Block Height
            els.blockHeight.textContent = Number(status.latest_block_height).toLocaleString();

            // Block Time
            const blockDate = new Date(status.latest_block_time);
            els.blockTime.textContent = blockDate.toLocaleString();

            // Peer Count
            els.peerCount.textContent = peers.n_peers;

            // Sync Status
            if (status.catching_up) {
                els.syncStatus.textContent = 'Syncing...';
                els.syncStatus.style.color = 'var(--accent-amber)';
                els.statusDot.className = 'status-dot status-dot--syncing';
                els.statusText.textContent = 'Syncing';
            } else {
                els.syncStatus.textContent = 'Synced ✓';
                els.syncStatus.style.color = 'var(--accent-emerald)';
                els.statusDot.className = 'status-dot';
                els.statusText.textContent = 'Online';
            }

            // Last Update
            els.lastUpdate.textContent = 'Updated: ' + new Date().toLocaleTimeString();

        } catch (err) {
            console.error('Failed to refresh node status:', err);
            els.statusDot.className = 'status-dot status-dot--error';
            els.statusText.textContent = 'Offline';
            els.blockHeight.textContent = '—';
            els.blockTime.textContent = '—';
            els.peerCount.textContent = '—';
            els.syncStatus.textContent = 'Error';
            els.syncStatus.style.color = 'var(--accent-rose)';
        }
    }

    // ─── Auto Refresh ────────────────────────────────────────────────────────

    function startCountdown() {
        countdown = AUTO_REFRESH_INTERVAL;
        els.refreshCountdown.textContent = countdown;

        if (countdownTimer) clearInterval(countdownTimer);

        countdownTimer = setInterval(() => {
            countdown--;
            els.refreshCountdown.textContent = countdown;

            if (countdown <= 0) {
                refreshNodeStatus();
                countdown = AUTO_REFRESH_INTERVAL;
            }
        }, 1000);
    }

    // ─── Wallet Query ────────────────────────────────────────────────────────

    function showError(message) {
        els.errorToast.textContent = '⚠ ' + message;
        els.errorToast.classList.add('active');
        setTimeout(() => els.errorToast.classList.remove('active'), 5000);
    }

    function clearResults() {
        els.walletResults.classList.remove('active');
        els.resultsGrid.innerHTML = '';
        els.errorToast.classList.remove('active');
    }

    function renderResult(label, value, small) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
      <div class="result-card__label">${escapeHtml(label)}</div>
      <div class="result-card__value ${small ? 'result-card__value--small' : ''}">${escapeHtml(value)}</div>
    `;
        els.resultsGrid.appendChild(card);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async function handleWalletQuery(e) {
        e.preventDefault();
        if (isQuerying) return;

        const address = els.walletAddress.value.trim();
        const valoper = els.valoperAddress.value.trim();

        // Validate
        if (!WALLET_ADDRESS_REGEX.test(address)) {
            showError('Invalid wallet address. Must start with "rai1" and be 39–59 characters.');
            return;
        }

        if (valoper && !VALOPER_ADDRESS_REGEX.test(valoper)) {
            showError('Invalid validator operator address. Must start with "raivaloper1".');
            return;
        }

        // Set loading state
        isQuerying = true;
        els.queryBtn.disabled = true;
        els.queryBtn.innerHTML = '<span class="spinner"></span> Querying...';
        clearResults();

        try {
            // Fetch balance
            const balance = await apiFetch(`/wallet/${encodeURIComponent(address)}/balance`);

            els.resultsGrid.innerHTML = '';
            renderResult('Balance (RAI)', balance.balance_rai);
            renderResult('Balance (arai)', balance.balance_arai);

            // Fetch delegation if valoper provided
            if (valoper) {
                try {
                    const delegation = await apiFetch(
                        `/wallet/${encodeURIComponent(address)}/delegation/${encodeURIComponent(valoper)}`
                    );
                    renderResult('Delegated (RAI)', delegation.balance_rai);
                    renderResult('Delegated (arai)', delegation.balance_arai);
                    renderResult('Shares', delegation.shares, true);
                    renderResult('Validator', delegation.validator_address, true);
                } catch (err) {
                    renderResult('Delegation', 'No delegation found', true);
                }
            }

            els.walletResults.classList.add('active');

        } catch (err) {
            showError(err.message || 'Failed to fetch wallet data');
        } finally {
            isQuerying = false;
            els.queryBtn.disabled = false;
            els.queryBtn.innerHTML = '🔍 Query Wallet';
        }
    }

    // ─── Event Listeners ─────────────────────────────────────────────────────

    els.walletForm.addEventListener('submit', handleWalletQuery);

    els.clearBtn.addEventListener('click', () => {
        els.walletAddress.value = '';
        els.valoperAddress.value = '';
        clearResults();
    });

    // ─── Initialize ───────────────────────────────────────────────────────────

    refreshNodeStatus();
    startCountdown();
})();
