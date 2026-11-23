#!/usr/bin/env bash
set -euo pipefail

UUID="battery-power@vant"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST_DIR"
cp "$SRC_DIR/extension.js" "$SRC_DIR/metadata.json" "$SRC_DIR/stylesheet.css" "$DEST_DIR/"

if gnome-extensions enable "$UUID" 2>/dev/null; then
  echo "Extensión '$UUID' instalada y activada."
else
  CURRENT="$(gsettings get org.gnome.shell enabled-extensions)"
  if [[ "$CURRENT" != *"'$UUID'"* ]]; then
    if [[ "$CURRENT" == "@as []" || "$CURRENT" == "[]" ]]; then
      gsettings set org.gnome.shell enabled-extensions "['$UUID']"
    else
      NEW="${CURRENT%]}, '$UUID']"
      gsettings set org.gnome.shell enabled-extensions "$NEW"
    fi
  fi
  echo "Extensión '$UUID' instalada y preactivada."
  echo "En Wayland, cierra sesión y vuelve a entrar (o reinicia) para cargarla."
fi
