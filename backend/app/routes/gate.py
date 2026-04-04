from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.dependencies import get_memrail_proxy, get_session
from app.models.gate import DecideRequest, GateDecision, GateDecisionResponse
from app.services.memrail_proxy import MemrailProxy
from app.services import agent_service
from app.services.session_service import SessionService

router = APIRouter()


@router.post("/decide", response_model=GateDecisionResponse)
async def decide(
    req: DecideRequest,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    budget_snapshot = None
    agent = None
    matched_budget = None

    # Enrich atoms if agent_id is provided
    if req.agent_id:
        agent = await agent_service.get_agent(req.agent_id)
        if agent:
            budgets = await agent_service.get_budgets(req.agent_id)

            # Find matching budget: check state.request.currency atom, else first budget
            currency = None
            for atom in req.atoms:
                if atom.get("path") == "state.request.currency":
                    currency = atom.get("value")
                    break

            if currency:
                matched_budget = next((b for b in budgets if b.token == currency), None)
            if not matched_budget and budgets:
                matched_budget = budgets[0]

            # Inject agent atoms
            agent_atoms = [
                {"path": "state.agent.id", "value": agent.id},
                {"path": "state.agent.name", "value": agent.name},
                {"path": "state.agent.eth_address", "value": agent.eth_address},
            ]

            # Inject budget atoms if we have a matching budget
            if matched_budget:
                remaining_tokens = agent_service._to_tokens(matched_budget.remaining, matched_budget.decimals)
                allocated_tokens = agent_service._to_tokens(matched_budget.allocated, matched_budget.decimals)
                spent_tokens = agent_service._to_tokens(matched_budget.spent, matched_budget.decimals)

                agent_atoms.extend([
                    # Native token amounts (primary — e.g. 5.0 ETH, 100.0 USDC)
                    {"path": "state.budget.remaining", "value": remaining_tokens},
                    {"path": "state.budget.allocated", "value": allocated_tokens},
                    {"path": "state.budget.spent", "value": spent_tokens},
                    # USD equivalents (derived)
                    {"path": "state.budget.remaining_usd", "value": matched_budget.remaining_usd},
                    {"path": "state.budget.allocated_usd", "value": matched_budget.allocated_usd},
                    {"path": "state.budget.spent_usd", "value": matched_budget.spent_usd},
                    {"path": "state.budget.utilization_pct", "value": matched_budget.utilization_pct},
                    # Token identity
                    {"path": "state.budget.token", "value": matched_budget.token},
                    {"path": "state.budget.chain_id", "value": matched_budget.chain_id},
                ])
                if matched_budget.token_address:
                    agent_atoms.append({"path": "state.budget.token_address", "value": matched_budget.token_address})
                if matched_budget.daily_limit:
                    daily_limit_tokens = agent_service._to_tokens(matched_budget.daily_limit, matched_budget.decimals)
                    daily_spent_tokens = agent_service._to_tokens(matched_budget.daily_spent, matched_budget.decimals)
                    daily_limit_usd = agent_service._to_usd(
                        matched_budget.daily_limit, matched_budget.decimals, matched_budget.usd_rate
                    )
                    daily_spent_usd = agent_service._to_usd(
                        matched_budget.daily_spent, matched_budget.decimals, matched_budget.usd_rate
                    )
                    agent_atoms.extend([
                        {"path": "state.budget.daily_limit", "value": daily_limit_tokens},
                        {"path": "state.budget.daily_spent", "value": daily_spent_tokens},
                        {"path": "state.budget.daily_limit_usd", "value": daily_limit_usd},
                        {"path": "state.budget.daily_spent_usd", "value": daily_spent_usd},
                    ])

            # Merge: agent atoms override any manually-set ones
            existing_paths = {a["path"] for a in agent_atoms}
            merged = [a for a in req.atoms if a.get("path") not in existing_paths]
            merged.extend(agent_atoms)
            req.atoms = merged

    try:
        raw = await proxy.decide(
            workspace=session["workspace"],
            project=session["project"],
            atoms=req.atoms,
            decision_point=req.decision_point,
            runtime_key=session["runtime_key"],
        )
        decision = GateDecision.from_decide_response(raw)
    except Exception as e:
        decision = GateDecision.error(str(e))

    # If ALLOW and agent has a budget, decrement spend
    if decision.allowed and agent and matched_budget:
        request_amount = None
        for atom in req.atoms:
            if atom.get("path") == "state.request.amount":
                request_amount = atom.get("value")
                break

        if request_amount is not None:
            try:
                token_amount = float(request_amount)
                raw_amount = str(int(token_amount * 10**matched_budget.decimals))
                updated = await agent_service.spend(agent.id, matched_budget.token, raw_amount)
                if updated:
                    budget_snapshot = {
                        "token": updated.token,
                        "chain_id": updated.chain_id,
                        "token_address": updated.token_address,
                        "decimals": updated.decimals,
                        "remaining": updated.remaining,
                        "spent": updated.spent,
                        "allocated": updated.allocated,
                        "remaining_usd": updated.remaining_usd,
                        "spent_usd": updated.spent_usd,
                        "allocated_usd": updated.allocated_usd,
                        "utilization_pct": updated.utilization_pct,
                    }
            except (ValueError, ZeroDivisionError):
                pass

    return GateDecisionResponse(
        allowed=decision.allowed,
        reason_code=decision.reason_code,
        reason=decision.reason,
        emu_key=decision.emu_key,
        invocation_id=decision.invocation_id,
        trace_id=decision.trace_id,
        budget_snapshot=budget_snapshot,
    )


# ── OWS Executable Policy Endpoint ──────────────────────────
# Called by the OWS policy executable instead of Memrail directly.
# Handles: auth, OWS→atom mapping, agent lookup, budget enrichment, decide, spend.


class OWSTransaction(BaseModel):
    to: str | None = None
    value: str | None = None
    raw_hex: str = ""
    data: str | None = None


class OWSSpending(BaseModel):
    daily_total: str = "0"
    date: str = ""


class OWSDecideRequest(BaseModel):
    chain_id: str = ""
    wallet_id: str = ""
    api_key_id: str = ""
    transaction: OWSTransaction = OWSTransaction()
    spending: OWSSpending = OWSSpending()
    # Config passed through from policy_config
    usd_rate: float = 0.0
    decimals: int = 18
    decision_point: str = "ows-gate"
    agent_id: str | None = None
    wallet_address: str | None = None  # eth address to look up agent


class OWSPolicyResult(BaseModel):
    allow: bool
    reason: str | None = None
    policy_id: str = "memrail-policy-gate"


async def _verify_api_key(authorization: str = Header(default="")) -> None:
    """Verify Bearer token matches the platform API key or a workspace integration key."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    # Accept platform admin key
    if token == settings.memrail_admin_api_key:
        return
    # Accept workspace integration key from DB
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT value FROM integration_config WHERE key = 'integration_api_key'"
    )
    if rows and rows[0]["value"] == token:
        return
    raise HTTPException(status_code=401, detail="Invalid API key")


@router.post("/ows-decide", response_model=OWSPolicyResult)
async def ows_decide(
    req: OWSDecideRequest,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    _auth: None = Depends(_verify_api_key),
):
    """
    OWS policy executable endpoint.
    Maps OWS PolicyContext fields to Memrail atoms, enriches with agent/budget
    data, calls Memrail decide, decrements budget on ALLOW.
    """
    tx = req.transaction

    # Build base atoms from OWS context
    atoms: list[dict] = [
        {"path": "state.chain_id", "value": req.chain_id},
        {"path": "state.wallet_id", "value": req.wallet_id},
        {"path": "state.api_key_id", "value": req.api_key_id},
    ]

    if tx.to:
        atoms.append({"path": "state.request.to", "value": tx.to})
    if tx.value and tx.value != "0":
        atoms.append({"path": "state.request.value", "value": tx.value})
    if tx.data and tx.data != "0x":
        atoms.append({"path": "state.request.data", "value": tx.data})

    # Convert wei → native token amount + USD
    if tx.value and tx.value != "0":
        try:
            token_amount = int(tx.value) / (10 ** req.decimals)
            atoms.append({"path": "state.request.amount", "value": token_amount})
            atoms.append({"path": "state.request.currency", "value": "ETH"})
            if req.usd_rate:
                atoms.append({"path": "state.request.amount_usd", "value": token_amount * req.usd_rate})
        except (ValueError, OverflowError):
            pass

    # Spending context
    daily_total = req.spending.daily_total
    if req.usd_rate and daily_total and daily_total != "0":
        try:
            daily_usd = int(daily_total) / (10 ** req.decimals) * req.usd_rate
            atoms.append({"path": "state.budget.daily_spent", "value": daily_usd})
        except (ValueError, OverflowError):
            pass

    # Resolve agent: by explicit ID, by wallet address, or skip
    agent = None
    if req.agent_id:
        agent = await agent_service.get_agent(req.agent_id)
    elif req.wallet_address:
        agent = await agent_service.get_agent_by_address(req.wallet_address)

    # Build a standard DecideRequest and reuse the existing logic
    decide_req = DecideRequest(
        atoms=atoms,
        decision_point=req.decision_point,
        agent_id=agent.id if agent else None,
    )

    # Get session context for workspace/project — use the default bootstrap session
    session = SessionService.get_default_session()
    if not session:
        return OWSPolicyResult(
            allow=False,
            reason="Policy Studio not bootstrapped — run setup first",
        )

    # Enrich with agent/budget atoms (reuse the enrichment logic from decide)
    matched_budget = None
    if agent:
        budgets = await agent_service.get_budgets(agent.id)

        currency = None
        for atom in decide_req.atoms:
            if atom.get("path") == "state.request.currency":
                currency = atom.get("value")
                break

        if currency:
            matched_budget = next((b for b in budgets if b.token == currency), None)
        if not matched_budget and budgets:
            matched_budget = budgets[0]

        agent_atoms = [
            {"path": "state.agent.id", "value": agent.id},
            {"path": "state.agent.name", "value": agent.name},
            {"path": "state.agent.eth_address", "value": agent.eth_address},
        ]

        if matched_budget:
            remaining_tokens = agent_service._to_tokens(matched_budget.remaining, matched_budget.decimals)
            allocated_tokens = agent_service._to_tokens(matched_budget.allocated, matched_budget.decimals)
            spent_tokens = agent_service._to_tokens(matched_budget.spent, matched_budget.decimals)

            agent_atoms.extend([
                {"path": "state.budget.remaining", "value": remaining_tokens},
                {"path": "state.budget.allocated", "value": allocated_tokens},
                {"path": "state.budget.spent", "value": spent_tokens},
                {"path": "state.budget.remaining_usd", "value": matched_budget.remaining_usd},
                {"path": "state.budget.allocated_usd", "value": matched_budget.allocated_usd},
                {"path": "state.budget.spent_usd", "value": matched_budget.spent_usd},
                {"path": "state.budget.utilization_pct", "value": matched_budget.utilization_pct},
                {"path": "state.budget.token", "value": matched_budget.token},
                {"path": "state.budget.chain_id", "value": matched_budget.chain_id},
            ])
            if matched_budget.token_address:
                agent_atoms.append({"path": "state.budget.token_address", "value": matched_budget.token_address})
            if matched_budget.daily_limit:
                daily_limit_tokens = agent_service._to_tokens(matched_budget.daily_limit, matched_budget.decimals)
                daily_spent_tokens = agent_service._to_tokens(matched_budget.daily_spent, matched_budget.decimals)
                daily_limit_usd = agent_service._to_usd(
                    matched_budget.daily_limit, matched_budget.decimals, matched_budget.usd_rate
                )
                daily_spent_usd = agent_service._to_usd(
                    matched_budget.daily_spent, matched_budget.decimals, matched_budget.usd_rate
                )
                agent_atoms.extend([
                    {"path": "state.budget.daily_limit", "value": daily_limit_tokens},
                    {"path": "state.budget.daily_spent", "value": daily_spent_tokens},
                    {"path": "state.budget.daily_limit_usd", "value": daily_limit_usd},
                    {"path": "state.budget.daily_spent_usd", "value": daily_spent_usd},
                ])

        existing_paths = {a["path"] for a in agent_atoms}
        merged = [a for a in decide_req.atoms if a.get("path") not in existing_paths]
        merged.extend(agent_atoms)
        decide_req.atoms = merged

    # Call Memrail decide
    try:
        raw = await proxy.decide(
            workspace=session["workspace"],
            project=session["project"],
            atoms=decide_req.atoms,
            decision_point=decide_req.decision_point,
            runtime_key=session["runtime_key"],
        )
        decision = GateDecision.from_decide_response(raw)
    except Exception as e:
        return OWSPolicyResult(allow=False, reason=f"Memrail error: {e}")

    # Decrement budget on ALLOW
    if decision.allowed and agent and matched_budget:
        request_amount = None
        for atom in decide_req.atoms:
            if atom.get("path") == "state.request.amount":
                request_amount = atom.get("value")
                break
        if request_amount is not None:
            try:
                token_amount = float(request_amount)
                raw_amount = str(int(token_amount * 10 ** matched_budget.decimals))
                await agent_service.spend(agent.id, matched_budget.token, raw_amount)
            except (ValueError, ZeroDivisionError):
                pass

    if decision.allowed:
        return OWSPolicyResult(allow=True)

    reason = decision.emu_key or decision.reason or "denied"
    return OWSPolicyResult(allow=False, reason=reason)
