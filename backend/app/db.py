import aiosqlite
import os

DB_PATH = os.getenv("DB_PATH", "ows_studio.db")
_db: aiosqlite.Connection | None = None


async def init_db():
    global _db
    _db = await aiosqlite.connect(DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.executescript("""
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            org TEXT NOT NULL,
            name TEXT NOT NULL,
            eth_address TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS integration_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS agent_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL REFERENCES agents(id),
            token TEXT NOT NULL,
            token_address TEXT,
            chain_id TEXT NOT NULL DEFAULT 'eip155:1',
            decimals INTEGER NOT NULL DEFAULT 18,
            allocated TEXT NOT NULL DEFAULT '0',
            spent TEXT NOT NULL DEFAULT '0',
            daily_limit TEXT,
            daily_spent TEXT NOT NULL DEFAULT '0',
            daily_reset_at TEXT,
            usd_rate REAL NOT NULL DEFAULT 0.0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(agent_id, token)
        );
    """)
    await _db.commit()

    # Migrations: add columns that may not exist in older DBs
    try:
        await _db.execute("ALTER TABLE agent_budgets ADD COLUMN chain_id TEXT NOT NULL DEFAULT 'eip155:1'")
        await _db.commit()
    except Exception:
        pass  # Column already exists


async def get_db() -> aiosqlite.Connection:
    if _db is None:
        await init_db()
    return _db
