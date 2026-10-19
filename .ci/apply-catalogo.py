"""Apply the reviewed catalog edits in an isolated checkout. No credentials or database access."""
import hashlib
import json
from pathlib import Path

root = Path.cwd().resolve()
changes = []
seen = set()
for manifest in sorted(root.glob('.ci/catalogo-edits-*.json')):
    for change in json.loads(manifest.read_text(encoding='utf-8')):
        path = root / change['path']
        if path.resolve().parent == root or root not in path.resolve().parents or path.is_symlink():
            raise RuntimeError('Invalid target path')
        if not (change['path'].startswith('app/') or change['path'].startswith('lib/')):
            raise RuntimeError('Target outside approved source scope')
        if change['path'] in seen:
            raise RuntimeError('Duplicate target')
        seen.add(change['path'])
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() == change['after']:
            continue
        if hashlib.sha256(raw).hexdigest() != change['before']:
            raise RuntimeError('Source changed: ' + change['path'])
        lines = raw.decode('utf-8').splitlines(keepends=True)
        for start, count, replacement in sorted(change['edits'], reverse=True):
            lines[start:start + count] = [replacement] if replacement else []
        result = ''.join(lines).encode('utf-8')
        if hashlib.sha256(result).hexdigest() != change['after']:
            raise RuntimeError('Output mismatch: ' + change['path'])
        changes.append((path, result))
if len(seen) != 18:
    raise RuntimeError('Incomplete manifest: expected 18 source files')
for path, result in changes:
    path.write_bytes(result)
print('Verified and applied', len(changes), 'source changes.')
