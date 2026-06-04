#!/usr/bin/env bash
# Download the static Source Han / Noto CJK OTFs used by the PDF themes into
# storage/fonts/. These are the premium 思源宋体/黑体 with real weights; loaded by
# absolute path at compile time (lib/latex/templates.ts). The dir is gitignored,
# so run this once per machine that compiles PDFs. If the fonts are absent the
# themes fall back to system fonts, so this is an enhancement, not a requirement.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="storage/fonts"
mkdir -p "$DEST"
BASE="https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main"
files=(
  "Sans/SubsetOTF/SC/NotoSansSC-Regular.otf"
  "Sans/SubsetOTF/SC/NotoSansSC-Medium.otf"
  "Sans/SubsetOTF/SC/NotoSansSC-Bold.otf"
  "Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf"
  "Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf"
)
for rel in "${files[@]}"; do
  name="$(basename "$rel")"
  if [ -s "$DEST/$name" ]; then
    echo "skip  $name (exists)"
  else
    echo "fetch $name"
    curl -sSL --max-time 120 -o "$DEST/$name" "$BASE/$rel"
  fi
done
echo "Done. Fonts in $DEST/"
