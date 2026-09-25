#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  echo 'Node.js가 필요합니다. https://nodejs.org 에서 설치한 후 다시 실행해 주세요.'
  read '?엔터를 누르면 닫습니다.'
  exit 1
fi
node tools/studio-server.mjs --open
