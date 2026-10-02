from pathlib import Path
import json
import subprocess
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parent.parent
out = root / 'test-output'
downloads = Path.home() / 'Downloads'
bulk = PdfReader(downloads / 'PrintsMen_Bulk_Audit.pdf')
counts = []
for page in bulk.pages:
    counts.append(sum(op == b'Do' for _, op in ContentStream(page.get_contents(), bulk).operations))
    assert abs(float(page.mediabox.width) - 330.2 * 72 / 25.4) < .001
    assert abs(float(page.mediabox.height) - 482.6 * 72 / 25.4) < .001
assert counts == [24, 24, 24, 13], counts
samples = [(Image.open(downloads / 'PrintsMen_Audit.png'), 'PRINTSMEN-TEST-001')]
for page, index, expected in [(bulk.pages[0], 5, 'PM001'), (bulk.pages[-1], -1, 'PM080')]:
    names = [args[0] for args, op in ContentStream(page.get_contents(), bulk).operations if op == b'Do']
    samples.append((page.images[names[index]].image, expected))
results = []
for im, expected in samples:
    im = im.convert('RGBA')
    white = Image.new('RGBA', im.size, 'white')
    white.alpha_composite(im)
    white = white.resize((512, 512))
    pixels = out / 'qr-pixels.bin'
    pixels.write_bytes(white.tobytes())
    script = "const fs=require('fs'),qr=require('./test-output/package/dist/jsQR.js');const data=new Uint8ClampedArray(fs.readFileSync('./test-output/qr-pixels.bin'));console.log(qr(data,512,512)?.data||'NOT_DECODED');"
    decoded = subprocess.check_output(['node', '-e', script], cwd=root, text=True).strip()
    assert decoded == expected, (decoded, expected)
    results.append(decoded)
pixels.unlink()
report = {'sheets': counts, 'total_badges': sum(counts), 'decoded_samples': results}
(out / 'bulk-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
