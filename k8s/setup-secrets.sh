#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="ows-studio"
SECRET_NAME="ows-studio-secrets"

echo "=== OWS Policy Studio — Secret Setup ==="
echo ""

# Try to load existing secrets
EXISTING=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null || echo "{}")

get_existing() {
  echo "$EXISTING" | python3 -c "
import sys, json, base64
data = json.load(sys.stdin).get('data', {})
val = data.get('$1', '')
if val: print(base64.b64decode(val).decode())
" 2>/dev/null || echo ""
}

# MEMRAIL_ADMIN_API_KEY
existing_memrail=$(get_existing MEMRAIL_ADMIN_API_KEY)
if [ -n "$existing_memrail" ]; then
  echo "MEMRAIL_ADMIN_API_KEY: using existing (${existing_memrail:0:8}...)"
  MEMRAIL_ADMIN_API_KEY="$existing_memrail"
else
  read -rp "MEMRAIL_ADMIN_API_KEY: " MEMRAIL_ADMIN_API_KEY
fi

# ANTHROPIC_API_KEY
existing_anthropic=$(get_existing ANTHROPIC_API_KEY)
if [ -n "$existing_anthropic" ]; then
  echo "ANTHROPIC_API_KEY: using existing (${existing_anthropic:0:8}...)"
  ANTHROPIC_API_KEY="$existing_anthropic"
else
  read -rp "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
fi

# JWT_SECRET — auto-generate if missing
existing_jwt=$(get_existing JWT_SECRET)
if [ -n "$existing_jwt" ]; then
  echo "JWT_SECRET: using existing"
  JWT_SECRET="$existing_jwt"
else
  JWT_SECRET=$(openssl rand -hex 32)
  echo "JWT_SECRET: auto-generated"
fi

echo ""
echo "Applying secret to namespace $NAMESPACE..."

kubectl create secret generic "$SECRET_NAME" \
  --namespace="$NAMESPACE" \
  --from-literal=MEMRAIL_ADMIN_API_KEY="$MEMRAIL_ADMIN_API_KEY" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Done."
