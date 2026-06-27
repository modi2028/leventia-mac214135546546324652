// Tiny synchronous JSON store. One file, keyed by guild id.
// Good enough for a single-process bot; swap for SQLite later if it grows.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const FILE = join(DIR, 'store.json');

function emptyGuild() {
    return {
        config: {},            // channel/role ids keyed by setting name
        infractions: [],       // { id, userId, type, reason, mod, ts }
        promotions: [],        // { id, userId, fromRank, toRank, reason, mod, ts }
        giveaways: {},         // messageId -> { channelId, prize, winners, endsAt, host, entries[], ended }
        tickets: {},           // channelId -> { userId, claimedBy, openedAt }
        ticketCounter: 0,
        afk: {},               // userId -> { reason, since }
        reviews: [],           // { id, staffId, stars, comment, author, ts }
        trainings: [],         // { id, type, host, when, status, ts }
        suggestions: [],       // { id, messageId, authorId, text, ts }
        roleplays: []          // { id, title, players, host, messageId, ts, revoked }
    };
}

let db = { guilds: {} };

function load() {
    try {
        if (existsSync(FILE)) db = JSON.parse(readFileSync(FILE, 'utf8'));
    } catch (e) {
        console.error('⚠️  store.json unreadable, starting fresh:', e.message);
        db = { guilds: {} };
    }
}
load();

let pending = null;
function save() {
    // Debounced atomic write.
    if (pending) return;
    pending = setTimeout(() => {
        pending = null;
        try {
            if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
            const tmp = FILE + '.tmp';
            writeFileSync(tmp, JSON.stringify(db, null, 2));
            renameSync(tmp, FILE);
        } catch (e) {
            console.error('⚠️  failed to save store:', e.message);
        }
    }, 250);
}

export function guild(id) {
    if (!db.guilds[id]) db.guilds[id] = emptyGuild();
    // Backfill any keys added in newer versions.
    const fresh = emptyGuild();
    for (const k of Object.keys(fresh)) if (!(k in db.guilds[id])) db.guilds[id][k] = fresh[k];
    return db.guilds[id];
}

export function persist() { save(); }

export function resetGuild(id) { db.guilds[id] = emptyGuild(); save(); }

// Monotonic id for list-style records within a guild collection.
export function nextId(arr) {
    return (arr.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
}

export function allGuilds() { return db.guilds; }

// Cross-guild data (shared across every server the bot is in), e.g. global bans.
export function globalStore() {
    if (!db.global) db.global = { bans: [] };
    return db.global;
}
