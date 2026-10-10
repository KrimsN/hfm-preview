#!/usr/bin/env bash
# Собирает описание GitHub Release из CHANGELOG.md: раздел версии, установка, ссылка на сравнение.
# Использование: scripts/release-notes.sh 0.1.3
set -euo pipefail

version="${1:?нужна версия, например 0.1.3}"
repo="KrimsN/hfm-preview"

section=$(awk -v h="## [$version]" '
  index($0, h) == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found
' CHANGELOG.md | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')

if [ -z "$section" ]; then
  echo "В CHANGELOG.md нет раздела [$version]" >&2
  exit 1
fi

previous=$(grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | sed -E 's/## \[(.*)\]/\1/' \
  | awk -v v="$version" 'seen { print; exit } $0 == v { seen = 1 }')

if [ -n "$previous" ]; then
  compare="https://github.com/$repo/compare/v$previous...v$version"
else
  compare="https://github.com/$repo/commits/v$version"
fi

cat <<NOTES
$section

### Установка

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=krimsn.hfm-preview) — для VS Code
- [Open VSX](https://open-vsx.org/extension/krimsn/hfm-preview) — для VSCodium, Cursor, Windsurf и др.
- Или скачайте \`hfm-preview-$version.vsix\` ниже и установите командой \`code --install-extension hfm-preview-$version.vsix\`.

**Full Changelog**: $compare
NOTES
