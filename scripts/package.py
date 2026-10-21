"""Reproducible unsigned Firefox and Chromium acceptance packages."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'extension'

def package(target):
    files = {}
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or path.name == 'manifest.chromium.json':
            continue
        name = path.relative_to(SOURCE).as_posix()
        if target == 'firefox' and name == 'worker.js':
            continue
        data = path.read_bytes()
        if name == 'manifest.json' and target == 'chromium':
            data = (SOURCE / 'manifest.chromium.json').read_bytes()
        files[name] = data
    build = ROOT / 'build' / target
    for name, data in files.items():
        path = build / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    suffix = '-unsigned' if target == 'firefox' else ''
    result = dist / f'x-toolbox-{target}{suffix}.zip'
    with ZipFile(result, 'w', compression=ZIP_DEFLATED) as archive:
        for name, data in files.items():
            info = ZipInfo(name, (2026, 10, 21, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    if target == 'firefox':
        (dist / 'x-toolbox-firefox-unsigned.xpi').write_bytes(result.read_bytes())
    return result

if __name__ == '__main__':
    results = [package('firefox'), package('chromium')]
    sums = []
    for path in results + [ROOT / 'dist/x-toolbox-firefox-unsigned.xpi']:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        sums.append(f'{digest}  {path.name}')
        print(path.name, path.stat().st_size, 'bytes')
    (ROOT / 'dist/SHA256SUMS.txt').write_text('\n'.join(sums) + '\n', encoding='utf-8')
