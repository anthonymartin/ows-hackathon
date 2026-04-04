from pydantic import BaseModel


class ToolCallAction(BaseModel):
    type: str = "tool_call"
    tool: dict


class EmuRegistration(BaseModel):
    emu_key: str
    intent: str
    trigger: str
    action: ToolCallAction
    priority: int = 5
    exclusion_groups: list[str] = []
    decision_point: str = "ows-gate"
    enabled: bool = True
    metadata: dict = {}


class EmuStateUpdate(BaseModel):
    enabled: bool


class EmuResponse(BaseModel):
    emu_key: str
    intent: str
    trigger: str
    action: dict
    priority: int
    exclusion_groups: list[str]
    decision_point: str
    enabled: bool
    metadata: dict = {}
