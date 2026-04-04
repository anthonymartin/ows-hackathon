from pydantic import BaseModel, field_validator


class AgentCreate(BaseModel):
    name: str
    eth_address: str  # 0x-prefixed, 42 chars


class Agent(BaseModel):
    id: str
    org: str
    name: str
    eth_address: str
    created_at: str


class AgentUpdate(BaseModel):
    name: str | None = None
    eth_address: str | None = None


class BudgetAllocate(BaseModel):
    token: str  # "ETH", "USDC", "SOL"
    token_address: str | None = None
    chain_id: str = "eip155:1"  # CAIP-2 chain ID per OWS spec: eip155:1, eip155:8453, solana:..., etc.
    decimals: int = 18
    allocated: str  # BigNumber string e.g. "5000000000000000000"
    usd_rate: float  # USD per 1 whole token
    daily_limit: str | None = None

    @field_validator("token", mode="before")
    @classmethod
    def normalize_token(cls, v: str) -> str:
        return v.strip().upper()


class BudgetUpdate(BaseModel):
    allocated: str | None = None
    usd_rate: float | None = None
    daily_limit: str | None = None


class AgentBudget(BaseModel):
    agent_id: str
    token: str
    token_address: str | None
    chain_id: str
    decimals: int
    allocated: str
    spent: str
    daily_limit: str | None
    daily_spent: str
    usd_rate: float
    # Computed
    remaining: str  # allocated - spent as BigNumber string
    remaining_usd: float
    allocated_usd: float
    spent_usd: float
    utilization_pct: float  # 0-100
