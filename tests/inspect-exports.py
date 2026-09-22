import json
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

downloads = Path.home() / 'Downloads'
pdf = PdfReader(downloads / 'PrintsMen_Audit.pdf')
assert len(pdf.pages) == 2
placements = []
for index, page in enumerate(pdf.pages):
    assert abs(float(page.mediabox.width) - 210 * 72 / 25.4) < 0.001
    assert abs(float(page.mediabox.height) - 297 * 72 / 25.4) < 0.001
    ops = ContentStream(page.get_contents(), pdf).operations
    count = sum(op == b'Do' for _, op in ops)
    assert count == (8 if index == 0 else 1)
    matrices = [list(map(float, args)) for args, op in ops if op == b'cm']
    scales = [m for m in matrices if abs(m[0] - 70 * 72 / 25.4) < 0.001]
    assert len(scales) == count
    for obj in page['/Resources']['/XObject'].values():
        image = obj.get_object()
        assert image['/Width'] == image['/Height'] == 827
    placements.append(count)
result = {'pdf_pages': 2, 'paper_mm': [210, 297], 'badges_per_page': placements, 'badge_mm': [70, 70], 'raster_pixels': [827, 827]}
for ext in ['png', 'jpg']:
    file = downloads / f'PrintsMen_Audit.{ext}'
    if not file.exists():
        continue
    im = Image.open(file)
    expected = 827 if ext == 'png' else 1654
    assert im.size == (expected, expected)
    dpi = im.info.get('dpi')
    assert dpi and abs(dpi[0] - (300 if ext == 'png' else 600)) < .1
    if ext == 'png':
        assert im.mode == 'RGBA' and im.getpixel((0, 0))[3] == 0
    result[ext] = {'size': im.size, 'dpi': dpi, 'mode': im.mode}
out = Path(__file__).resolve().parent.parent / 'test-output'
out.mkdir(exist_ok=True)
(out / 'export-verification.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
