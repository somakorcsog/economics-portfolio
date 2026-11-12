#!/bin/bash
# Mac: double-click this file to preview the website.
cd "$(dirname "$0")"
echo "Preview running at http://localhost:8000  (close this window to stop)"
open "http://localhost:8000"
python3 -m http.server 8000
