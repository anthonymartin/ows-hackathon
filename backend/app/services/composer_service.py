import json
import re

import anthropic

from app.config import settings
from app.gate.conventions import GATE_TOOL_IDS, GATE_EXCLUSION_GROUP
from app.prompts.system_prompt import POLICY_COMPOSER_SYSTEM


class ComposerValidationError(Exception):
    pass


class ComposerService:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def draft(self, description: str) -> dict:
        response = await self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=POLICY_COMPOSER_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": f"Create a policy EMU for: {description}",
                }
            ],
        )
        text = response.content[0].text
        emu = self._extract_json(text)
        self._validate_emu(emu)
        return emu

    async def refine(self, existing_emu: dict, instruction: str) -> dict:
        response = await self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=POLICY_COMPOSER_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": f"Here is an existing policy EMU:\n```json\n{json.dumps(existing_emu, indent=2)}\n```\n\nPlease modify it: {instruction}",
                }
            ],
        )
        text = response.content[0].text
        emu = self._extract_json(text)
        self._validate_emu(emu)
        return emu

    def _extract_json(self, text: str) -> dict:
        # Try to find JSON in code blocks first
        match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
        if match:
            text = match.group(1)

        # Try to parse the text as JSON directly
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find a JSON object in the text
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            # LLM returned text instead of JSON — likely a refusal or clarification
            raise ComposerValidationError(
                "The AI could not generate a valid policy from that description. "
                "Try being more specific, e.g. 'Deny transactions over $10,000' or "
                "'Allow approved vendors when operator is verified'."
            )

    def _validate_emu(self, emu: dict) -> None:
        # Check required fields
        required = ["emu_key", "intent", "trigger", "action"]
        for field in required:
            if field not in emu:
                raise ComposerValidationError(f"Missing required field: {field}")

        action = emu["action"]
        if action.get("type") != "tool_call":
            raise ComposerValidationError(f"action.type must be 'tool_call', got '{action.get('type')}'")

        tool = action.get("tool", {})
        tool_id = tool.get("tool_id", "")
        if tool_id not in GATE_TOOL_IDS:
            raise ComposerValidationError(
                f"action.tool.tool_id must be one of {GATE_TOOL_IDS}, got '{tool_id}'"
            )

        args = tool.get("args", {})
        if "reason" not in args:
            raise ComposerValidationError("action.tool.args must contain 'reason'")

        # Clamp priority to valid range 0-9
        priority = emu.get("priority", 5)
        if isinstance(priority, int):
            emu["priority"] = max(0, min(9, priority))
        else:
            emu["priority"] = 5

        # Ensure exclusion groups
        exclusion_groups = emu.get("exclusion_groups", [])
        if GATE_EXCLUSION_GROUP not in exclusion_groups:
            emu["exclusion_groups"] = [GATE_EXCLUSION_GROUP] + exclusion_groups

        # Ensure decision_point
        if "decision_point" not in emu:
            emu["decision_point"] = "ows-gate"

        # Ensure enabled
        if "enabled" not in emu:
            emu["enabled"] = True
