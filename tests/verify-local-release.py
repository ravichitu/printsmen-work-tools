"""Inspect actual UI-generated local release exports, not synthetic substitutes."""
import json
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image
from pypdf import PdfReader

downloads = Path.home() / 'Downloads'
project = json.loads((downloads / 'PrintsMen_Local_Release_Test.badge.json').read_text())
assert len(project['pages']) == 3
assert len(project['fonts']) == 1
image = project['pages'][2]['objects'][0]
asset = project['assets'][image['asset']]
assert (asset['w'], asset['h']) == (1280, 2048)
crop = image['crop']
assert abs(crop['w'] * asset['w'] - crop['h'] * asset['h']) < 0.001
assert 0 <= crop['x'] < crop['x'] + crop['w'] <= 1.000001
assert 0 <= crop['y'] < crop['y'] + crop['h'] <= 1.000001
svg = ET.parse(downloads / 'PrintsMen_Local_Release_Test.svg').getroot()
assert svg.get('width') == '70mm'
assert 'data:font/ttf;base64,' in ''.join(svg.itertext())
png = Image.open(downloads / 'PrintsMen_Local_Release_Test.png')
assert png.size == (827, 827)
assert png.mode == 'RGBA'
assert abs(png.info['dpi'][0] - 300) < 0.1
assert png.getpixel((0, 0))[3] == 0
assert any(r < 100 and g < 150 and b < 180 and a == 255
           for r, g, b, a in png.crop((180, 360, 640, 460)).getdata())
page = PdfReader(downloads / 'PrintsMen_100mm_Calibration.pdf').pages[0]
mm = 25.4 / 72
assert abs(float(page.mediabox.width) * mm - 210) < 0.001
assert abs(float(page.mediabox.height) * mm - 297) < 0.001
ops = page.get_contents().operations
square_edges = [list(map(float, args)) for args, op in ops if op == b'l'][:3]
assert abs(square_edges[0][1] * mm - 100) < 0.001
assert abs(square_edges[1][0] * mm - 100) < 0.001
assert '100 x 100 mm' in page.extract_text()
result = {'image_pages': 2, 'embedded_fonts': 1, 'rotated_asset': [asset['w'], asset['h']],
          'crop_aspect': '1:1', 'png_pixels': list(png.size), 'png_dpi': png.info['dpi'],
          'calibration_sheet_mm': [210, 297], 'calibration_square_mm': [100, 100]}
Path('test-output').mkdir(exist_ok=True)
Path('test-output/local-release-verification.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
