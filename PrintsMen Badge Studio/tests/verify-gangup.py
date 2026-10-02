"""Inspect actual UI-generated 0.3.0 PDFs; does not generate substitute exports."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ContentStream


def multiply(m, n):
    a, b, c, d, e, f = m
    g, h, i, j, k, l = n
    return (a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f)


downloads = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads'
cases = [
    ('PrintsMen_030_12x18.pdf', (304.8, 457.2), [24, 1], [[24], [1]]),
    ('PrintsMen_030_Mixed.pdf', (330.2, 482.6), [12], [[5, 7]]),
    ('PrintsMen_030_Separate.pdf', (482.6, 330.2), [5, 7], [[5], [7]]),
]
results = []
mm = 72 / 25.4
for filename, paper, counts, design_counts in cases:
    pdf = PdfReader(downloads / filename)
    assert len(pdf.pages) == len(counts), filename
    sheet_results = []
    for index, page in enumerate(pdf.pages):
        assert abs(float(page.mediabox.width) / mm - paper[0]) < .001
        assert abs(float(page.mediabox.height) / mm - paper[1]) < .001
        matrix = (1, 0, 0, 1, 0, 0)
        stack, boxes, hashes = [], [], []
        for args, op in ContentStream(page.get_contents(), pdf).operations:
            if op == b'q':
                stack.append(matrix)
            elif op == b'Q':
                matrix = stack.pop()
            elif op == b'cm':
                matrix = multiply(matrix, tuple(map(float, args)))
            elif op == b'Do':
                image = page['/Resources']['/XObject'][args[0]].get_object()
                assert image['/Subtype'] == '/Image'
                assert image['/Width'] == image['/Height'] == 827
                hashes.append(hashlib.sha256(image.get_data()).hexdigest())
                a, b, c, d, x, y = [v / mm for v in matrix]
                assert abs(a - 70) < .001 and abs(d - 70) < .001
                assert abs(b) < .001 and abs(c) < .001
                assert x >= 5-.001 and y >= 5-.001
                assert x+a <= paper[0]-5+.001 and y+d <= paper[1]-5+.001
                boxes.append((x, y, a, d))
        assert len(boxes) == counts[index], (filename, index, len(boxes))
        assert sorted(Counter(hashes).values()) == sorted(design_counts[index])
        for i, (x, y, w, h) in enumerate(boxes):
            for xx, yy, ww, hh in boxes[i+1:]:
                assert x+w+2 <= xx+.001 or xx+ww+2 <= x+.001 or y+h+2 <= yy+.001 or yy+hh+2 <= y+.001
        sheet_results.append({'copies': len(boxes), 'copies_per_design': sorted(Counter(hashes).values())})
    results.append({'file': filename, 'paper_mm': paper, 'badge_mm': [70, 70], 'raster_px': [827, 827], 'sheets': sheet_results})

out = Path(__file__).resolve().parent.parent / 'test-output'
out.mkdir(exist_ok=True)
(out / 'gangup-verification.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
