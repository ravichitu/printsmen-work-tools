"""Verify real 0.4.0 UI downloads. Requires Pillow, pypdf and QA-only jsQR."""
import json
import math
import subprocess
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parent.parent
downloads = Path.home() / 'Downloads'
out = root / 'test-output'
project = json.loads((downloads / 'PrintsMen_040_Photo.badge.json').read_text())
photo = project['pages'][3]['objects'][0]
assert photo['photoRotation'] == 90
assert photo['w'] == photo['h'] == 52
assert photo['crop'] == {'x': .25, 'y': .25, 'w': .5, 'h': .5}
source = project['assets'][photo['asset']]
assert source['w'] == source['h'] == 512
later = json.loads((downloads / 'PrintsMen_040_Smart.badge.json').read_text())
later_photo = later['pages'][3]['objects'][0]
assert later_photo['photoRotation'] == 0
assert later['assets'][later_photo['asset']]['data'] == source['data']
assert project['pages'][:3] == later['pages'][:3], 'Other pages must remain unchanged'
im = Image.open(downloads / 'PrintsMen_040_Photo.png')
assert im.size == (math.ceil(60/25.4*300), math.ceil(90/25.4*300))
assert abs(im.info['dpi'][0]-300) < .1

pdf = PdfReader(downloads / 'PrintsMen_040_Smart.pdf')
assert len(pdf.pages) == 2
mm = 72/25.4
for page in pdf.pages:
    assert abs(float(page.mediabox.width)/mm-100) < .001
    assert abs(float(page.mediabox.height)/mm-70) < .001
    ops = ContentStream(page.get_contents(), pdf).operations
    assert sum(op == b'Do' for _, op in ops) == 1
    matrices = [list(map(float, args)) for args, op in ops if op == b'cm']
    assert any(abs(m[0]) < 1e-8 and abs(m[1]-1) < 1e-8 and abs(m[2]+1) < 1e-8 for m in matrices)
    assert any(abs(m[0]/mm-60) < .001 and abs(m[3]/mm-90) < .001 for m in matrices)
    for image in page['/Resources']['/XObject'].values():
        image = image.get_object()
        assert (image['/Width'], image['/Height']) == im.size

qr = Image.open(downloads / 'PrintsMen_040_QR.png').convert('RGBA')
white = Image.new('RGBA', qr.size, 'white')
white.alpha_composite(qr)
pixels = out / 'caption-qr-pixels.bin'
pixels.write_bytes(white.tobytes())
script = "const fs=require('fs'),qr=require('./test-output/package/dist/jsQR.js');const b=new Uint8ClampedArray(fs.readFileSync('./test-output/caption-qr-pixels.bin'));console.log(qr(b,Number(process.argv[1]),Number(process.argv[2]))?.data||'NOT_DECODED')"
decoded = subprocess.check_output(['node', '-e', script, str(qr.width), str(qr.height)], cwd=root, text=True).strip()
assert decoded == 'PRINTSMEN-040-CAPTION', decoded
report = {'photo_original_preserved': True, 'other_pages_unchanged': True, 'photo_zoom_percent': 200, 'photo_rotation': 90, 'png_pixels': im.size, 'pdf_paper_mm': [100, 70], 'pdf_copies': [1, 1], 'rotated_badge_mm': [90, 60], 'qr_payload': decoded}
(out / 'upgrade-export-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
