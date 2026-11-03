import json,sys,re,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import corrections
DATE=os.environ.get('HDATE','2026-10-26'); DAY=int(os.environ.get('HDAY','1')); DLONG=os.environ.get('HDLONG','Monday, October 26, 2026')
counts={}
segs_f, ann_f, roster_f, outdir = sys.argv[1:5]
d=json.load(open(segs_f)); segs=d['segs']
roster=json.load(open(roster_f))
segs[-1]['text']=segs[-1]['text'].replace(' Sync to video time','').replace('Sync to video time','')
ann={}
for line in open(ann_f):
    line=line.rstrip('\n')
    if not line: continue
    i,ph,sp=line.split('|')
    assert sp in roster, sp
    ann.setdefault(int(i),[]).append((ph,sp))
def tosec(t):
    p=[int(x) for x in t.split(':')]; s=0
    for x in p: s=s*60+x
    return s
pieces=[]; cur='UNIDENTIFIED'; problems=[]
for i,s in enumerate(segs):
    txt=s['text']; cuts=[]; pos=0
    for ph,sp in ann.get(i,[]):
        if ph=='':
            cuts.append((0,sp)); continue
        k=txt.find(ph,pos)
        if k<0: problems.append((i,ph)); continue
        cuts.append((k,sp)); pos=k+1
    cuts.sort(key=lambda c:c[0])
    bounds=[(0,cur)]+cuts
    # collapse cuts at same position (keep last)
    clean=[]
    for b in bounds:
        if clean and clean[-1][0]==b[0]: clean[-1]=b
        else: clean.append(b)
    for j,(k,sp) in enumerate(clean):
        end=clean[j+1][0] if j+1<len(clean) else len(txt)
        piece=txt[k:end].strip()
        if piece: pieces.append({'seg':i,'t':s['t'],'sec':tosec(s['t']),'speaker':sp,'text':piece})
        cur=sp
if problems:
    print('PHRASE NOT FOUND:',problems); sys.exit(1)
turns=[]
for p in pieces:
    if turns and turns[-1]['speaker_id']==p['speaker']:
        turns[-1]['raw_text']+=' '+p['text']; turns[-1]['lines'].append({'t':p['t'],'sec':p['sec'],'text':corrections.fix(p['text'],counts),'raw_text':p['text']})
    else:
        r=roster[p['speaker']]
        turns.append({'speaker_id':p['speaker'],'speaker':r['name'],'role':r['role'],'t':p['t'],'sec':p['sec'],'raw_text':p['text'],'lines':[{'t':p['t'],'sec':p['sec'],'text':corrections.fix(p['text'],counts),'raw_text':p['text']}]})
meta={'title':d['title'],'hearing_date':DATE,'day':DAY,'hearing_long':DLONG,'case':'PSC of West Virginia evidentiary hearing, case number read on the record as 26-000075 (NextEra Energy Transmission MidAtlantic, Mid-Atlantic Resiliency Link (MARL) project)','source':'YouTube auto-captions (raw transcript supplied by user); text has caption errors corrected by inference, raw_text keeps the original caption wording','timestamps':'video playback position (H:MM:SS) in the hearing live stream'}
for n,t in enumerate(turns):
    t['turn']=n+1; t['text']=corrections.fix(t['raw_text'])
json.dump({'meta':meta,'speakers':roster,'turns':turns},open(f'{outdir}/{DATE}_transcript.json','w'),indent=1)
with open(f'{outdir}/{DATE}_turns.jsonl','w') as f:
    for t in turns:
        f.write(json.dumps({'hearing_date':meta['hearing_date'],'day':DAY,'turn':t['turn'],'t':t['t'],'sec':t['sec'],'speaker':t['speaker'],'role':t['role'],'text':t['text'],'raw_text':t['raw_text'],'lines':t['lines']})+'\n')
with open(f'{outdir}/{DATE}_transcript.md','w') as f:
    f.write(f"# {d['title']}\n\nHearing date: {DLONG} (Day {DAY})  \nCase: {meta['case']}  \nTimestamps are positions in the YouTube live stream. Text is the YouTube auto-caption wording with speaker names added and obvious caption errors corrected (for example \"moral\" to MARL, \"PGM\" to PJM, misheard names). The JSON files keep the original caption wording beside each corrected line.\n\n")
    for t in turns:
        f.write(f"**[{t['t']}] {t['speaker']}:** {t['text']}\n\n")
from collections import Counter
c=Counter(t['speaker_id'] for t in turns)
print(len(pieces),'pieces',len(turns),'turns'); json.dump(counts,open(f'{outdir}/{DATE}_corrections_applied.json','w'),indent=1); print(sum(counts.values()),'line-level fixes')
