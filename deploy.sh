#!/usr/bin/env bash
set -euo pipefail

REGISTRY="10.26.1.201:5000"
NAMESPACE="ows-studio"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"

echo "=== OWS Policy Studio — Deploy ==="
echo "Registry: $REGISTRY"
echo "Tag: $TAG"
echo ""

# Preflight: check secrets exist
echo "Checking secrets..."
if ! kubectl get secret ows-studio-secrets -n "$NAMESPACE" &>/dev/null; then
  echo "ERROR: Secret 'ows-studio-secrets' not found in namespace '$NAMESPACE'."
  echo "Run: bash k8s/setup-secrets.sh"
  exit 1
fi
echo "Secrets OK."

# Build and push
echo ""
echo "Building backend..."
docker build -t "$REGISTRY/ows-studio-api:$TAG" -t "$REGISTRY/ows-studio-api:latest" backend/

echo ""
echo "Building frontend..."
docker build -t "$REGISTRY/ows-studio-frontend:$TAG" -t "$REGISTRY/ows-studio-frontend:latest" frontend/

echo ""
echo "Pushing images..."
docker push "$REGISTRY/ows-studio-api:$TAG"
docker push "$REGISTRY/ows-studio-api:latest"
docker push "$REGISTRY/ows-studio-frontend:$TAG"
docker push "$REGISTRY/ows-studio-frontend:latest"

# Apply k8s manifests
echo ""
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment-api.yaml
kubectl apply -f k8s/deployment-frontend.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/ingress.yaml

# Restart deployments to pick up new images
echo ""
echo "Restarting deployments..."
kubectl rollout restart deployment/ows-studio-api -n "$NAMESPACE"
kubectl rollout restart deployment/ows-studio-frontend -n "$NAMESPACE"

# Verify
echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/ows-studio-api -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/ows-studio-frontend -n "$NAMESPACE" --timeout=120s

echo ""
echo "Deploy complete. Pods:"
kubectl get pods -n "$NAMESPACE"
