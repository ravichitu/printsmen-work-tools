from pathlib import Path
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parent / 'fixtures'
out.mkdir(exist_ok=True)
doc = canvas.Canvas(str(out / 'three-pages.pdf'), pagesize=(144, 216))
for i in range(3):
    doc.setFillColorRGB(.88, .94, .96)
    doc.rect(0, 0, 144, 216, fill=1, stroke=0)
    doc.setFillColorRGB(.1, .4, .5)
    doc.setFont('Helvetica', 15)
    doc.drawString(12, 170, f'PDF PAGE {i + 1}')
    doc.rect(12, 20, 120, 120, fill=0, stroke=1)
    doc.showPage()
doc.save()
im = Image.new('RGBA', (600, 400), (255, 255, 255, 255))
d = ImageDraw.Draw(im)
d.rectangle((40, 40, 560, 360), fill=(18, 108, 83, 255))
d.ellipse((180, 80, 420, 320), fill='white')
d.text((220, 185), 'PRINTSMEN', fill=(18, 108, 83, 255))
im.save(out / 'background-holes.png', dpi=(300, 300))
(out / 'bulk-80.csv').write_text('Name,Code\n' + ''.join(f'Guest {i:03},PM{i:03}\n' for i in range(1, 81)), encoding='utf-8')
print(out)
