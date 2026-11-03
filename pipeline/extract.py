import zipfile,re,sys
x=zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode()
out=[]
for p in re.findall(r'<w:p[ >].*?</w:p>',x,re.S):
    out.append(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>',p)))
open(sys.argv[2],'w').write('\n'.join(out))
