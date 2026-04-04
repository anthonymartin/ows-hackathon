import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_session
from app.models.agent import Agent, AgentBudget, AgentCreate, AgentUpdate, BudgetAllocate, BudgetUpdate
from app.services import agent_service

router = APIRouter()

# ── Token price cache ────────────────────────────────────
# CoinGecko free tier: 30 req/min, no API key needed.
# We cache for 60s to stay well within limits.

_price_cache: dict = {}
_price_cache_ts: float = 0
_CACHE_TTL = 60  # seconds

# Map our token symbols → CoinGecko IDs
_COINGECKO_IDS: dict[str, str] = {
    "ETH": "ethereum",
    "BTC": "bitcoin",
    "SOL": "solana",
    "USDC": "usd-coin",
    "USDT": "tether",
    "MATIC": "matic-network",
    "ATOM": "cosmos",
    "SUI": "sui",
    "AVAX": "avalanche-2",
    "BNB": "binancecoin",
    "TRX": "tron",
    "TON": "the-open-network",
    "XRP": "ripple",
    "FIL": "filecoin",
    "DOT": "polkadot",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "ARB": "arbitrum",
    "OP": "optimism",
}


async def _fetch_prices() -> dict[str, float]:
    global _price_cache, _price_cache_ts
    now = time.time()
    if _price_cache and (now - _price_cache_ts) < _CACHE_TTL:
        return _price_cache

    ids = ",".join(_COINGECKO_IDS.values())
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        # Reverse-map: CoinGecko ID → our symbol → price
        result: dict[str, float] = {}
        gecko_to_symbol = {v: k for k, v in _COINGECKO_IDS.items()}
        for gecko_id, prices in data.items():
            symbol = gecko_to_symbol.get(gecko_id)
            if symbol and "usd" in prices:
                result[symbol] = prices["usd"]

        _price_cache = result
        _price_cache_ts = now
        return result
    except Exception:
        # Return stale cache on error, or empty if no cache
        return _price_cache


@router.get("/prices")
async def get_prices():
    """Fetch live USD prices for supported tokens via CoinGecko (cached 60s)."""
    prices = await _fetch_prices()
    return prices


@router.post("", response_model=Agent)
async def create_agent(
    req: AgentCreate,
    session: dict = Depends(get_session),
):
    try:
        return await agent_service.create_agent(session["org"], req.name, req.eth_address)
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="Agent with this ETH address already exists")
        raise


@router.get("", response_model=list[Agent])
async def list_agents(session: dict = Depends(get_session)):
    return await agent_service.list_agents(session["org"])


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, session: dict = Depends(get_session)):
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: str,
    req: AgentUpdate,
    session: dict = Depends(get_session),
):
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        updated = await agent_service.update_agent(agent_id, name=req.name, eth_address=req.eth_address)
        return updated
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="Agent with this ETH address already exists")
        raise


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, session: dict = Depends(get_session)):
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await agent_service.delete_agent(agent_id)
    return {"deleted": True}


@router.post("/{agent_id}/budgets", response_model=AgentBudget)
async def allocate_budget(
    agent_id: str,
    req: BudgetAllocate,
    session: dict = Depends(get_session),
):
    agent = await agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return await agent_service.allocate_budget(agent_id, req)


@router.get("/{agent_id}/budgets", response_model=list[AgentBudget])
async def list_budgets(agent_id: str, session: dict = Depends(get_session)):
    return await agent_service.get_budgets(agent_id)


@router.patch("/{agent_id}/budgets/{token}", response_model=AgentBudget)
async def update_budget(
    agent_id: str,
    token: str,
    req: BudgetUpdate,
    session: dict = Depends(get_session),
):
    budget = await agent_service.update_budget(agent_id, token, req)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.delete("/{agent_id}/budgets/{token}")
async def delete_budget(
    agent_id: str,
    token: str,
    session: dict = Depends(get_session),
):
    deleted = await agent_service.delete_budget(agent_id, token)
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"deleted": True}
