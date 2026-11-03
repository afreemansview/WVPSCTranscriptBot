#!/bin/bash
# Rebuild every day's transcript from data/days/<date>/ and write transcripts/.
# Needs python3 with python-docx (pip install python-docx).
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
while IFS=$'\t' read -r DATE DAY LONG; do
  D=data/days/$DATE
  sort -t'|' -k1,1n -s $D/speakers.txt -o $D/speakers.txt
  (cd pipeline && HDATE=$DATE HDAY=$DAY HDLONG="$LONG" python3 build.py "$ROOT/$D/segments.json" "$ROOT/$D/speakers.txt" "$ROOT/data/roster.json" "$ROOT/transcripts")
  python3 pipeline/mkdocx.py transcripts/${DATE}_transcript.json transcripts/${DATE}_transcript_speakers.docx
  python3 - "$DATE" <<'PY'
import json,re,sys
d=json.load(open(f'transcripts/{sys.argv[1]}_transcript.json'))
bad=[t['turn'] for t in d['turns'] if re.findall(r'\d+',t['text'])!=re.findall(r'\d+',t['raw_text'].replace('&amp;','&'))]
print(sys.argv[1],'turns with changed numbers:',bad)
sys.exit(1 if bad else 0)
PY
done < data/days.tsv
cat transcripts/2026-10-2*_turns.jsonl transcripts/2026-10-3*_turns.jsonl > transcripts/all_days_turns.jsonl
wc -l transcripts/all_days_turns.jsonl
