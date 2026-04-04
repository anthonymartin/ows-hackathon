from app.gate.conventions import (
    GATE_TOOL_ALLOW,
    GATE_TOOL_DENY,
    GATE_EXCLUSION_GROUP,
    GATE_DECISION_POINT,
)


def _tool_action(tool_id: str, reason_code: str, reason: str) -> dict:
    return {
        "type": "tool_call",
        "intent": reason,
        "tool": {
            "tool_id": tool_id,
            "version": "1.0.0",
            "args": {
                "reason_code": reason_code,
                "reason": reason,
            },
        },
    }


STARTER_EMUS = [
    {
        "emu_key": "deny_unknown_operator",
        "intent": "Deny transactions from unknown operators",
        "trigger": "NOT state.operator.verified",
        "action": _tool_action(
            GATE_TOOL_DENY,
            "unknown_operator",
            "Operator is not verified",
        ),
        "priority": 9,
        "exclusion_groups": [GATE_EXCLUSION_GROUP],
        "decision_point": GATE_DECISION_POINT,
        "enabled": True,
        "metadata": {"source": "starter_pack"},
    },
    {
        "emu_key": "deny_overspend",
        "intent": "Deny transactions exceeding remaining budget",
        "trigger": "state.request.amount > state.budget.remaining",
        "action": _tool_action(
            GATE_TOOL_DENY,
            "overspend",
            "Budget fully utilized",
        ),
        "priority": 8,
        "exclusion_groups": [GATE_EXCLUSION_GROUP],
        "decision_point": GATE_DECISION_POINT,
        "enabled": True,
        "metadata": {"source": "starter_pack"},
    },
    {
        "emu_key": "deny_unapproved_collection",
        "intent": "Deny spend on unapproved collections",
        "trigger": "tag.collection_status != 'approved'",
        "action": _tool_action(
            GATE_TOOL_DENY,
            "unapproved_collection",
            "Collection is not approved for spend",
        ),
        "priority": 7,
        "exclusion_groups": [GATE_EXCLUSION_GROUP],
        "decision_point": GATE_DECISION_POINT,
        "enabled": True,
        "metadata": {"source": "starter_pack"},
    },
    {
        "emu_key": "allow_approved_vendor",
        "intent": "Allow transactions from approved vendors",
        "trigger": "tag.vendor_status == 'approved' AND state.operator.verified",
        "action": _tool_action(
            GATE_TOOL_ALLOW,
            "approved_vendor",
            "Vendor is approved and operator verified",
        ),
        "priority": 5,
        "exclusion_groups": [GATE_EXCLUSION_GROUP],
        "decision_point": GATE_DECISION_POINT,
        "enabled": True,
        "metadata": {"source": "starter_pack"},
    },
    {
        "emu_key": "default_allow",
        "intent": "Default allow for verified operators",
        "trigger": "state.operator.verified",
        "action": _tool_action(
            GATE_TOOL_ALLOW,
            "default_pass",
            "Request passes default policy checks",
        ),
        "priority": 1,
        "exclusion_groups": [GATE_EXCLUSION_GROUP],
        "decision_point": GATE_DECISION_POINT,
        "enabled": True,
        "metadata": {"source": "starter_pack"},
    },
]
