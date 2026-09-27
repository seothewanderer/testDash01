from pathlib import Path
from pdf2image import convert_from_path
import json
from pypdf import PdfReader
root=Path(__file__).resolve().parent/'rendered'
poppler=Path('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')
summary={}
for pdf in sorted(root.glob('*.pdf')):
    prefix=pdf.name[:2];out=root/prefix;out.mkdir(exist_ok=True)
    images=convert_from_path(str(pdf),dpi=105,poppler_path=str(poppler))
    for i,img in enumerate(images):img.save(out/f'page-{i+1:02}.png')
    text='\f'.join(p.extract_text(extraction_mode='layout') for p in PdfReader(pdf).pages)
    (out/'content.txt').write_text(text,encoding='utf8')
    pages=text.split('\f')
    if not pages[-1].strip():pages.pop()
    summary[prefix]=[]
    for i,t in enumerate(pages):
        lines=[l.strip() for l in t.splitlines() if l.strip()]
        summary[prefix].append({'page':i+1,'lines':len(lines),'first':lines[:2],'last':lines[-3:]})
    print(prefix,'PAGES',len(images))
    for i,p in enumerate(summary[prefix]):print(p)
(root/'page-audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
