#!/bin/zsh
# Double-click to start Crows Chart and open it in your browser.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
(sleep 2; open "http://127.0.0.1:5178") &
npm start
