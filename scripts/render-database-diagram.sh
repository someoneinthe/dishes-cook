#!/usr/bin/env bash
# Renders the database diagram (the Mermaid block that `npm run db:diagram` writes into
# docs/database.md) to SVG and PNG with Mermaid's CLI, for the GitHub release.
#
#   scripts/render-database-diagram.sh [output-dir]   (default: dist/database-diagram)
#
# Uses an installed Chrome (CHROME_PATH, else google-chrome / chromium / macOS Chrome): Puppeteer's
# own browser download is skipped. The CLI runs through npx, pinned, instead of being a project
# dependency: it isn't needed to build or test the app.
set -euo pipefail

out_dir=${1:-dist/database-diagram}
chrome=${CHROME_PATH:-$(command -v google-chrome || command -v chromium || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')}
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

# The diagram itself: the lines between ```mermaid and ```.
sed -n '/^```mermaid$/,/^```$/p' docs/database.md | sed '1d;$d' > "$work_dir/diagram.mmd"
if [ ! -s "$work_dir/diagram.mmd" ]; then
  echo "No Mermaid diagram in docs/database.md: run npm run db:diagram." >&2
  exit 1
fi

# No sandbox: Ubuntu runners forbid the unprivileged user namespaces Chrome's sandbox needs.
printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }\n' "$chrome" > "$work_dir/puppeteer.json"

mkdir -p "$out_dir"
for format in svg png; do
  PUPPETEER_SKIP_DOWNLOAD=true npx --yes \
    -p @mermaid-js/mermaid-cli@12.0.0 -p puppeteer@25.12.0 \
    mmdc --input "$work_dir/diagram.mmd" --output "$out_dir/database-diagram.$format" \
    --puppeteerConfigFile "$work_dir/puppeteer.json" --backgroundColor white --scale 2 --quiet
done
echo "Rendered $out_dir/database-diagram.svg and .png"
