from dataclasses import dataclass, field
from pydantic import BaseModel

from app.gate.conventions import GATE_TOOL_ALLOW, GATE_TOOL_DENY, GATE_TOOL_IDS


@dataclass
class GateDecision:
    allowed: bool
    reason_code: str | None = None
    reason: str | None = None
    emu_key: str | None = None
    invocation_id: str = ""
    trace_id: str | None = None
    raw_selected: list = field(default_factory=list)

    @classmethod
    def from_decide_response(cls, response: dict) -> "GateDecision":
        invocation_id = response.get("invocation_id", "")
        trace_id = response.get("trace_id")
        selected = response.get("selected", [])

        for item in selected:
            payload = item.get("payload", {})
            if payload.get("type") != "tool_call":
                continue
            tool = payload.get("tool", {})
            tool_id = tool.get("tool_id", "")
            if tool_id not in GATE_TOOL_IDS:
                continue

            args = tool.get("args", {})
            return cls(
                allowed=tool_id == GATE_TOOL_ALLOW,
                reason_code=args.get("reason_code"),
                reason=args.get("reason"),
                emu_key=item.get("emu_key"),
                invocation_id=invocation_id,
                trace_id=trace_id,
                raw_selected=selected,
            )

        # No gate verdict found — default deny
        return cls(
            allowed=False,
            reason_code="no_matching_rule",
            reason="No policy matched this request",
            invocation_id=invocation_id,
            trace_id=trace_id,
            raw_selected=selected,
        )

    @classmethod
    def error(cls, message: str) -> "GateDecision":
        return cls(
            allowed=False,
            reason_code="system_error",
            reason=message,
        )


class DecideRequest(BaseModel):
    atoms: list[dict]
    decision_point: str = "ows-gate"
    agent_id: str | None = None


class GateDecisionResponse(BaseModel):
    allowed: bool
    reason_code: str | None = None
    reason: str | None = None
    emu_key: str | None = None
    invocation_id: str = ""
    trace_id: str | None = None
    budget_snapshot: dict | None = None
