#!/usr/bin/env bash
# Scaffolds a kit game folder. Usage:
#   scripts/new-game.sh <slug> "<Title>" "<page colour>" "<description>" '<tags json>' '<controls json>' "<players>" "<accent>"
set -e
cd "$(dirname "$0")/.."
slug="$1"; title="$2"; color="$3"
mkdir -p "games/$slug"
sed -e "s/<title>My Game<\/title>/<title>$title<\/title>/" -e "s/aria-label=\"My Game\"/aria-label=\"$title game\"/" \
    -e "s/theme-color\" content=\"#121017\"/theme-color\" content=\"$color\"/" -e "s/background: #121017;/background: $color;/" \
    games/_template-canvas/index.html > "games/$slug/index.html"
printf '{\n  "title": "%s",\n  "description": "%s",\n  "authors": ["Kush Honkalse"],\n  "tags": %s,\n  "controls": %s,\n  "orientation": "any",\n  "players": "%s",\n  "accent": "%s",\n  "added": "%s"\n}\n' \
  "$title" "$4" "$5" "$6" "$7" "$8" "$(date +%F)" > "games/$slug/game.json"
echo "created games/$slug"
