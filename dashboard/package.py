"""Copy the standalone HTML and package reproducible sources for team sharing."""
import shutil
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent
output = root.parent / 'deliverables'
output.mkdir(exist_ok=True)
shutil.copyfile(root / 'dist/index.html', output / '드론_진로탐색_대시보드_시각화개선.html')
shutil.copyfile(root / 'README.md', output / '사용안내_시각화개선.md')
with zipfile.ZipFile(output / '드론_진로탐색_프로젝트_시각화개선.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(root.parent / 'AGENTS.md', 'AGENTS.md')
    for path in sorted(root.rglob('*')):
        if path.is_file() and not {'__pycache__', 'test-output', '.venv'}.intersection(path.relative_to(root).parts):
            archive.write(path, path.relative_to(root.parent))
with zipfile.ZipFile(output / '드론_진로탐색_프로젝트_시각화개선.zip') as archive:
    assert archive.testzip() is None
    assert archive.read('dashboard/dist/index.html') == (output / '드론_진로탐색_대시보드_시각화개선.html').read_bytes()
for path in output.iterdir():
    print(f'{path.name}: {path.stat().st_size:,} bytes')
