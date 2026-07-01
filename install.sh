#!/usr/bin/env bash
set -euo pipefail

KRUX_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON="${PYTHON:-python}"

echo ""
echo "  [KRUX] installing terminalcore link mapper"
echo "  [KRUX] target: $KRUX_DIR"
echo ""

# -- system deps (arch) --
if command -v pacman &>/dev/null; then
    echo "  [KRUX] checking system deps..."
    needs=()
    for pkg in webkit2gtk gobject-introspection libsoup3; do
        if ! pacman -Q "$pkg" &>/dev/null 2>&1; then
            needs+=("$pkg")
        fi
    done
    if [ ${#needs[@]} -gt 0 ]; then
        echo "  [KRUX] installing: ${needs[*]}"
        if [ "$(id -u)" -eq 0 ]; then
            pacman -S --noconfirm "${needs[@]}"
        else
            echo "  [KRUX] need root. trying sudo..."
            sudo pacman -S --noconfirm "${needs[@]}"
        fi
    else
        echo "  [KRUX] system deps satisfied"
    fi
elif command -v apt &>/dev/null; then
    echo "  [KRUX] debian-based..."
    needs=()
    for pkg in gir1.2-webkit2-4.1 gir1.2-gtk-3.0 libgirepository1.0-dev; do
        if ! dpkg -l "$pkg" &>/dev/null 2>&1; then
            needs+=("$pkg")
        fi
    done
    if [ ${#needs[@]} -gt 0 ]; then
        sudo apt install -y "${needs[@]}"
    fi
fi

# -- python install --
echo "  [KRUX] installing krux package..."
"$PYTHON" -m pip install -e "$KRUX_DIR" 2>/dev/null || \
    "$PYTHON" -m pip install -e "$KRUX_DIR" --user

echo "  [KRUX] installing gui extras..."
"$PYTHON" -m pip install 'pywebview>=4' 2>/dev/null || \
    "$PYTHON" -m pip install 'pywebview>=4' --user

# -- ensure on path --
KRUX_BIN="$("$PYTHON" -m site --user-base 2>/dev/null)/bin"
if ! command -v krux &>/dev/null; then
    echo ""
    echo "  [KRUX] add to your .bashrc / .zshrc:"
    echo "    export PATH=\"\$PATH:$KRUX_BIN\""
    echo ""
fi

echo ""
echo "  [KRUX] done. run 'krux' to start."
echo "  [KRUX] flags:  --no-webview    (browser mode)"
echo "                 --version, -v   (show version)"
echo ""
