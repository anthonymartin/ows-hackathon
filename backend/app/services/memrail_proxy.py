from memrail import AsyncAMIClient
from memrail.atoms import state, tag, event


class MemrailProxy:
    """Thin wrapper around the Memrail AsyncAMIClient SDK."""

    def __init__(self, client: AsyncAMIClient):
        self.client = client

    async def bootstrap(self, org: str, team: str, workspace: str, project: str) -> dict:
        result = await self.client.bootstrap_organization(
            slug=org,
            name=org,
            region="us-miami-1",
            template="full",
            initial_project=project,
        )
        return result

    async def get_workspace_id(self, workspace_slug: str) -> str:
        """Get workspace_id from slug."""
        ws = await self.client.get_workspace(workspace_slug)
        return ws["workspace_id"]

    async def create_workspace_key(self, workspace_id: str, name: str) -> dict:
        """Create a workspace-scoped API key via admin endpoint."""
        return await self.client.transport.post(
            "/v1/admin/api-keys",
            json={
                "name": name,
                "scope": {
                    "level": "workspace",
                    "workspace_id": workspace_id,
                },
            },
        )

    @staticmethod
    def _normalize_emu_fields(emu_data: dict) -> tuple[dict | None, dict]:
        """Normalize action and build policy dict from EMU data."""
        action = emu_data.get("action")
        if action:
            action = dict(action)
            tool = action.get("tool", {})
            if isinstance(tool, dict) and "version" not in tool:
                tool = dict(tool)
                tool["version"] = "1.0.0"
                action["tool"] = tool
            # action.intent must be <= 64 chars
            intent = action.get("intent") or emu_data.get("intent", "")
            action["intent"] = intent[:64]

        policy = {
            "mode": "auto",
            "priority": emu_data.get("priority", 5),
            "cooldown": {"seconds": 0, "gate": "ack"},
            "idempotency": {"enabled": False, "boundary": "workspace", "roles": "auto", "scope": []},
        }
        if emu_data.get("exclusion_groups"):
            policy["exclusion_groups"] = emu_data["exclusion_groups"]

        return action, policy

    async def register_emu(
        self, workspace: str, project: str, emu_data: dict
    ) -> dict:
        action, policy = self._normalize_emu_fields(emu_data)

        return await self.client.register_emu(
            emu_key=emu_data["emu_key"],
            trigger=emu_data["trigger"],
            action=action,
            intent=emu_data.get("intent"),
            policy=policy,
            metadata=emu_data.get("metadata"),
            state="active" if emu_data.get("enabled", True) else "draft",
            workspace=workspace,
            project=project,
        )

    async def list_emus(self, workspace: str | None = None, project: str | None = None) -> list[dict]:
        # Use workspace-scoped endpoint to ensure only this project's EMUs are returned
        # (the global /v1/emus endpoint with query params doesn't filter reliably with admin keys)
        ws = workspace or self.client.config.workspace or "development"
        proj = project or self.client.config.project or "default"
        result = await self.client.transport.get(
            f"/v1/workspaces/{ws}/projects/{proj}/emus?limit=100",
        )
        # Normalize API response to match frontend expectations
        emus = []
        for emu in result.get("emus", []):
            policy = emu.get("policy", {})
            emus.append({
                **emu,
                "enabled": emu.get("state") == "active",
                "priority": policy.get("priority", 5),
                "exclusion_groups": policy.get("exclusion_groups") or [],
                "decision_point": emu.get("decision_point") or "ows-gate",
            })
        return emus

    async def update_emu(
        self, workspace: str, project: str, emu_key: str, emu_data: dict
    ) -> dict:
        action, policy = self._normalize_emu_fields(emu_data)

        return await self.client.update_emu(
            emu_key=emu_key,
            trigger=emu_data["trigger"],
            action=action,
            intent=emu_data.get("intent"),
            policy=policy,
            expected_utility=0.8,
            confidence=0.9,
            metadata=emu_data.get("metadata"),
            workspace=workspace,
            project=project,
        )

    async def update_emu_lifecycle(
        self, workspace: str, project: str, emu_key: str, state_val: str
    ) -> dict:
        return await self.client.update_emu_lifecycle(
            emu_key, state_val, workspace=workspace, project=project
        )

    async def decide(
        self,
        workspace: str,
        project: str,
        atoms: list[dict],
        decision_point: str,
        runtime_key: str,
    ) -> dict:
        # Build typed atoms from raw dicts
        typed_atoms = []
        for a in atoms:
            path = a.get("path", "")
            value = a.get("value")
            if path.startswith("state."):
                typed_atoms.append(state(path[len("state."):], value))
            elif path.startswith("tag."):
                typed_atoms.append(tag(path[len("tag."):], value))
            elif path.startswith("event."):
                typed_atoms.append(event(path[len("event."):]))
            # skip unknown atom types

        # Use the main client for decide (already authenticated with platform key)
        # Pass workspace/project as method params to override config
        response = await self.client.decide(
            atoms=typed_atoms,
            decision_point=decision_point,
            workspace=workspace,
            project=project,
        )

        # Convert InvokeResponse to dict for GateDecision.from_decide_response()
        # The SDK returns response as a dict-like structure
        selected = []
        resp_data = response if isinstance(response, dict) else response.__dict__ if hasattr(response, '__dict__') else {}

        # Handle both SDK object and raw dict responses
        items = []
        if hasattr(response, 'selected'):
            items = response.selected
        elif isinstance(response, dict):
            items = response.get("selected", [])

        for item in items:
            # Normalize: item may be dict or SDK object
            if isinstance(item, dict):
                emu_key = item.get("emu_key")
                item_id = item.get("id")
                score = item.get("score")
                activation_id = item.get("activation_id")
                action = item.get("action") or item.get("payload")
            else:
                emu_key = getattr(item, "emu_key", None)
                item_id = getattr(item, "id", None)
                score = getattr(item, "score", None)
                activation_id = getattr(item, "activation_id", None)
                action = getattr(item, "action", None)

            entry: dict = {
                "emu_key": emu_key,
                "id": item_id,
                "score": score,
                "activation_id": activation_id,
            }

            if action:
                if isinstance(action, dict):
                    tool = action.get("tool", {})
                    entry["payload"] = {
                        "type": action.get("type", "tool_call"),
                        "tool": {
                            "tool_id": tool.get("tool_id") if isinstance(tool, dict) else getattr(tool, "tool_id", None),
                            "args": tool.get("args") if isinstance(tool, dict) else getattr(tool, "args", {}),
                        },
                    }
                else:
                    # SDK object with .type, .name, .args etc
                    entry["payload"] = {
                        "type": getattr(action, "type", "tool_call"),
                        "tool": {
                            "tool_id": getattr(action, "name", None) or getattr(action, "tool_id", None),
                            "args": getattr(action, "args", {}),
                        },
                    }
            selected.append(entry)

        invocation_id = ""
        trace_id = None
        if hasattr(response, "invocation_id"):
            invocation_id = response.invocation_id
        elif isinstance(response, dict):
            invocation_id = response.get("invocation_id", "")

        trace = getattr(response, "trace", None) if not isinstance(response, dict) else response.get("trace")
        if isinstance(trace, dict):
            trace_id = trace.get("trace_id")

        result = {
            "invocation_id": invocation_id,
            "trace_id": trace_id,
            "selected": selected,
        }
        return result

    async def list_traces(self, limit: int = 50) -> list[dict]:
        """List recent traces via the Memrail API (not exposed in SDK)."""
        result = await self.client.transport.get(
            "/v1/traces",
            params={"limit": limit},
        )
        return result.get("traces", [])

    async def get_trace(self, trace_id: str, workspace: str | None = None, project: str | None = None) -> dict:
        return await self.client.get_trace(
            trace_id,
            workspace=workspace,
            project=project,
        )
