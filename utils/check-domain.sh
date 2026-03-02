#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"

echo "=== DNS Check: $DOMAIN ==="
echo ""

echo "## A Records (root → IP)"
dig "$DOMAIN" A +short
echo ""

echo "## CNAME (www → target)"
dig "www.$DOMAIN" CNAME +short
echo ""

echo "## Nameservers"
dig "$DOMAIN" NS +short
echo ""

echo "## HTTPS Response"
curl -sI "https://$DOMAIN" | head -5
