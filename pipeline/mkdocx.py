import json,sys,docx
from docx.shared import Pt,RGBColor
d=json.load(open(sys.argv[1])); doc=docx.Document()
st=doc.styles['Normal']; st.font.name='Calibri'; st.font.size=Pt(11)
doc.add_heading(d['meta']['title'],1)
doc.add_paragraph(f"Hearing date: {d['meta'].get('hearing_long','')} (Day {d['meta']['day']})\n"+d['meta']['case']+'\nTimestamps are positions in the YouTube live stream. Text is the YouTube auto-caption wording with speaker names added and obvious caption errors corrected (for example "moral" to MARL, "PGM" to PJM, misheard names).')
doc.add_heading('Speakers',2)
used={t['speaker_id'] for t in d['turns']}
for k,v in d['speakers'].items():
    if k in used: doc.add_paragraph(f"{v['name']}" + (f": {v['role']}" if v['role'] else ''),style='List Bullet')
doc.add_heading('Transcript',2)
for t in d['turns']:
    p=doc.add_paragraph(); r=p.add_run(f"[{t['t']}] "); r.font.color.rgb=RGBColor(0x66,0x66,0x66)
    p.add_run(t['speaker']+': ').bold=True; p.add_run(t['text'])
doc.save(sys.argv[2])
