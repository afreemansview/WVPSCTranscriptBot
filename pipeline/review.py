import json,sys
segs=json.load(open(sys.argv[1]))['segs']
lo,hi=int(sys.argv[3]),int(sys.argv[4])
for line in open(sys.argv[2]):
    i,ph,sp=line.rstrip('\n').split('|'); i=int(i)
    if not(lo<=i<hi) or ph: continue
    prev=segs[i-1]['text'][-38:] if i else ''
    print(f"{i} {sp[:8]:8}|{prev}||{segs[i]['text'][:45]}")
