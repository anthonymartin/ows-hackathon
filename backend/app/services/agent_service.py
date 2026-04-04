import uuid

from app.db import get_db
from app.models.agent import Agent, AgentBudget, BudgetAllocate, BudgetUpdate


def _to_usd(raw: str, decimals: int, usd_rate: float) -> float:
    """Convert raw BigNumber string to USD float."""
    return int(raw) / 10**decimals * usd_rate


def _to_tokens(raw: str, decimals: int) -> float:
    """Convert raw BigNumber string to native token amount (e.g. 5.0 ETH)."""
    return int(raw) / 10**decimals


def _bignum_subtract(a: str, b: str) -> str:
    """Subtract two BigNumber strings, floor at 0."""
    result = int(a) - int(b)
    return str(max(result, 0))


def _bignum_add(a: str, b: str) -> str:
    return str(int(a) + int(b))


def _build_budget(row: dict) -> AgentBudget:
    allocated = row["allocated"]
    spent = row["spent"]
    decimals = row["decimals"]
    usd_rate = row["usd_rate"]
    remaining = _bignum_subtract(allocated, spent)
    allocated_usd = _to_usd(allocated, decimals, usd_rate)
    spent_usd = _to_usd(spent, decimals, usd_rate)
    remaining_usd = _to_usd(remaining, decimals, usd_rate)
    utilization_pct = (spent_usd / allocated_usd * 100) if allocated_usd > 0 else 0.0

    return AgentBudget(
        agent_id=row["agent_id"],
        token=row["token"],
        token_address=row["token_address"],
        chain_id=row["chain_id"] if "chain_id" in row.keys() else "eip155:1",
        decimals=decimals,
        allocated=allocated,
        spent=spent,
        daily_limit=row["daily_limit"],
        daily_spent=row["daily_spent"],
        usd_rate=usd_rate,
        remaining=remaining,
        remaining_usd=remaining_usd,
        allocated_usd=allocated_usd,
        spent_usd=spent_usd,
        utilization_pct=round(utilization_pct, 2),
    )


async def create_agent(org: str, name: str, eth_address: str) -> Agent:
    db = await get_db()
    agent_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO agents (id, org, name, eth_address) VALUES (?, ?, ?, ?)",
        (agent_id, org, name, eth_address),
    )
    await db.commit()
    row = await db.execute_fetchall(
        "SELECT * FROM agents WHERE id = ?", (agent_id,)
    )
    r = row[0]
    return Agent(id=r["id"], org=r["org"], name=r["name"], eth_address=r["eth_address"], created_at=r["created_at"])


async def list_agents(org: str) -> list[Agent]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM agents WHERE org = ? ORDER BY created_at DESC", (org,)
    )
    return [
        Agent(id=r["id"], org=r["org"], name=r["name"], eth_address=r["eth_address"], created_at=r["created_at"])
        for r in rows
    ]


async def get_agent(agent_id: str) -> Agent | None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM agents WHERE id = ?", (agent_id,))
    if not rows:
        return None
    r = rows[0]
    return Agent(id=r["id"], org=r["org"], name=r["name"], eth_address=r["eth_address"], created_at=r["created_at"])


async def update_agent(agent_id: str, name: str | None = None, eth_address: str | None = None) -> Agent | None:
    db = await get_db()
    sets = []
    params = []
    if name is not None:
        sets.append("name = ?")
        params.append(name)
    if eth_address is not None:
        sets.append("eth_address = ?")
        params.append(eth_address)
    if not sets:
        return await get_agent(agent_id)
    params.append(agent_id)
    await db.execute(f"UPDATE agents SET {', '.join(sets)} WHERE id = ?", params)
    await db.commit()
    return await get_agent(agent_id)


async def delete_agent(agent_id: str) -> bool:
    db = await get_db()
    await db.execute("DELETE FROM agent_budgets WHERE agent_id = ?", (agent_id,))
    cursor = await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
    await db.commit()
    return cursor.rowcount > 0


async def get_agent_by_address(eth_address: str) -> Agent | None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM agents WHERE eth_address = ?", (eth_address,))
    if not rows:
        return None
    r = rows[0]
    return Agent(id=r["id"], org=r["org"], name=r["name"], eth_address=r["eth_address"], created_at=r["created_at"])


async def allocate_budget(agent_id: str, data: BudgetAllocate) -> AgentBudget:
    db = await get_db()
    await db.execute(
        """INSERT INTO agent_budgets (agent_id, token, token_address, chain_id, decimals, allocated, usd_rate, daily_limit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(agent_id, token) DO UPDATE SET
             allocated = excluded.allocated,
             token_address = excluded.token_address,
             chain_id = excluded.chain_id,
             decimals = excluded.decimals,
             usd_rate = excluded.usd_rate,
             daily_limit = excluded.daily_limit,
             updated_at = datetime('now')""",
        (agent_id, data.token, data.token_address, data.chain_id, data.decimals, data.allocated, data.usd_rate, data.daily_limit),
    )
    await db.commit()
    return await get_budget(agent_id, data.token)


async def get_budgets(agent_id: str) -> list[AgentBudget]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM agent_budgets WHERE agent_id = ? ORDER BY token", (agent_id,)
    )
    return [_build_budget(r) for r in rows]


async def get_budget(agent_id: str, token: str) -> AgentBudget | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM agent_budgets WHERE agent_id = ? AND token = ?", (agent_id, token)
    )
    if not rows:
        return None
    return _build_budget(rows[0])


async def update_budget(agent_id: str, token: str, data: BudgetUpdate) -> AgentBudget | None:
    db = await get_db()
    sets = []
    params = []
    if data.allocated is not None:
        sets.append("allocated = ?")
        params.append(data.allocated)
    if data.usd_rate is not None:
        sets.append("usd_rate = ?")
        params.append(data.usd_rate)
    if data.daily_limit is not None:
        sets.append("daily_limit = ?")
        params.append(data.daily_limit)
    if not sets:
        return await get_budget(agent_id, token)
    sets.append("updated_at = datetime('now')")
    params.extend([agent_id, token])
    await db.execute(
        f"UPDATE agent_budgets SET {', '.join(sets)} WHERE agent_id = ? AND token = ?",
        params,
    )
    await db.commit()
    return await get_budget(agent_id, token)


async def delete_budget(agent_id: str, token: str) -> bool:
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM agent_budgets WHERE agent_id = ? AND token = ?", (agent_id, token)
    )
    await db.commit()
    return cursor.rowcount > 0


async def spend(agent_id: str, token: str, amount_raw: str) -> AgentBudget | None:
    """Atomically increment spent for an agent's token budget."""
    db = await get_db()
    # Use CAST to do integer addition in SQLite on string columns
    await db.execute(
        """UPDATE agent_budgets
           SET spent = CAST(CAST(spent AS INTEGER) + CAST(? AS INTEGER) AS TEXT),
               daily_spent = CAST(CAST(daily_spent AS INTEGER) + CAST(? AS INTEGER) AS TEXT),
               updated_at = datetime('now')
           WHERE agent_id = ? AND token = ?""",
        (amount_raw, amount_raw, agent_id, token),
    )
    await db.commit()
    return await get_budget(agent_id, token)
