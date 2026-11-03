import re,sys,json
lines=open(sys.argv[1]).read().split('\n')
title=lines[0].strip()
segs=[];i=1
ts=re.compile(r'^(\d+:)?\d{1,2}:\d{2}$')
while i<len(lines):
    l=lines[i].strip()
    if ts.match(l):
        t=l; i+=1
        if i<len(lines) and re.match(r'^\d+ (hours?|minutes?|seconds?)',lines[i].strip()): i+=1
        txt=[]
        while i<len(lines) and not ts.match(lines[i].strip()):
            if lines[i].strip(): txt.append(lines[i].strip())
            i+=1
        segs.append({'t':t,'text':' '.join(txt)})
    else:
        if l: print('STRAY',i,l,file=sys.stderr)
        i+=1
json.dump({'title':title,'segs':segs},open(sys.argv[2],'w'))
with open(sys.argv[3],'w') as f:
    for n,s in enumerate(segs): f.write(f"{n}|{s['t']}|{s['text']}\n")
print(len(segs),segs[-1]['t'])
