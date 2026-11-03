"""Write public/data/turns.json, the compact turn list the website and its API search.

Each turn: id ("<day>-<turn>"), day, date, t (stream time), sec, sp (speaker), role,
text (corrected), and ln: [[sec, text], ...] the caption lines with their own times,
so a quote can link to the exact second.
"""
import json, glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = []
speakers = {}
for f in sorted(glob.glob(os.path.join(root, 'transcripts', '2026-*_transcript.json'))):
    d = json.load(open(f)); m = d['meta']
    for t in d['turns']:
        out.append({
            'id': f"{m['day']}-{t['turn']}", 'day': m['day'], 'date': m['hearing_date'],
            't': t['t'], 'sec': t['sec'], 'sp': t['speaker'], 'role': t.get('role', ''),
            'text': t['text'], 'ln': [[l['sec'], l['text']] for l in t['lines']],
        })
        speakers[t['speaker']] = t.get('role', '')
os.makedirs(os.path.join(root, 'public', 'data'), exist_ok=True)
with open(os.path.join(root, 'public', 'data', 'turns.json'), 'w') as fh:
    json.dump({'turns': out, 'speakers': speakers}, fh, separators=(',', ':'), ensure_ascii=False)
print(len(out), 'turns,', len(speakers), 'speakers')
