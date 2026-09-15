#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
 printf '%s\n' 'Python 3.9+ is required. Install from python.org and retry.'
 read answer; exit 1
fi
python3 server/start_server.py --open --page index.html
