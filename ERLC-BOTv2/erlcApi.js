// Thin wrapper around the PRC (Police Roleplay Community) ER:LC API.
// Uses Node 18+ built-in fetch — no node-fetch dependency needed.

// PRC migrated from api.policeroleplay.community → api.erlc.gg (the old host now 403s).
const BASE_URL = process.env.ERLC_API_URL || 'https://api.erlc.gg/v1';

function serverKey() {
    const key = process.env.ERLC_SERVER_KEY;
    if (!key) throw new Error('ERLC_SERVER_KEY is not set in .env');
    return key;
}

async function erlcRequest(endpoint, { method = 'GET', body } = {}) {
    // Cache-bust GETs so we never get a stale snapshot from a proxy.
    const bust = method === 'GET'
        ? `${endpoint.includes('?') ? '&' : '?'}_=${Date.now()}`
        : '';

    const res = await fetch(`${BASE_URL}${endpoint}${bust}`, {
        method,
        headers: {
            'Server-Key': serverKey(),
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (!res.ok) {
        let detail = '';
        try {
            const data = await res.json();
            // PRC returns { code, message } on errors.
            detail = data?.message ? ` — ${data.message}` : '';
        } catch { /* non-JSON error body */ }
        throw new Error(`ERLC API ${res.status}${detail}`);
    }

    // Some endpoints (command POST) return 200 with an empty body.
    const text = await res.text();
    return text ? JSON.parse(text) : {};
}

export const getServerInfo  = () => erlcRequest('/server');
export const getPlayers     = () => erlcRequest('/server/players');
export const getJoinLogs    = () => erlcRequest('/server/joinlogs');
export const getKillLogs    = () => erlcRequest('/server/killlogs');
export const getCommandLogs = () => erlcRequest('/server/commandlogs');
export const getBans        = () => erlcRequest('/server/bans');
export const getVehicles    = () => erlcRequest('/server/vehicles');
export const getQueue       = () => erlcRequest('/server/queue');

// command should already include the in-game ":" prefix, e.g. ":heal John".
export const sendCommand = (command) =>
    erlcRequest('/server/command', { method: 'POST', body: { command } });

export async function getRobloxUsername(userId) {
    if (!userId) return 'N/A';
    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (!res.ok) return String(userId);
        const data = await res.json();
        return data.displayName || data.name || String(userId);
    } catch {
        return String(userId);
    }
}
