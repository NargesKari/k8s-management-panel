#!/usr/bin/env bash
# Regenerates the grafana-dashboards ConfigMap from every .json file in
# ../dashboards, then applies it and restarts Grafana so the change is
# picked up immediately.
#
# Run this after adding or editing a dashboard JSON file:
#   ./scripts/apply-dashboards.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="${SCRIPT_DIR}/../dashboards"

kubectl create configmap grafana-dashboards \
  --namespace monitoring-system \
  --from-file="${DASHBOARD_DIR}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/grafana -n monitoring-system

echo "Dashboards applied. Grafana is restarting."
