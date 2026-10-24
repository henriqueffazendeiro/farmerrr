"""Build the isolated wordmark study from outlined Arial Black glyphs.

Requires fontTools and the locally installed Arial Black font. No font file is
distributed: the exported SVG contains only vector shapes.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'brand'
OUT.mkdir(parents=True, exist_ok=True)
font = TTFont('C:/Windows/Fonts/ariblk.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 120 / font['head'].unitsPerEm


def lettering(text):
    pen = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    cursor = 0
    for character in text:
        name = cmap[ord(character)]
        transform = (scale, 0, 0, -scale, cursor, 0)
        glyphs[name].draw(TransformPen(pen, transform))
        glyphs[name].draw(TransformPen(bounds, transform))
        cursor += glyphs[name].width * scale - 4.2
    return pen.getCommands(), bounds.bounds


left, lb = lettering('farme')
right, rb = lettering('rrr.')
left_x = -lb[0]
box_x = lb[2] - lb[0] + 3
right_x = box_x + 8 - rb[0]
box_y = rb[1] - 9
box_height = rb[3] - rb[1] + 18
box_width = rb[2] - rb[0] + 16
top = min(lb[1], box_y)
bottom = max(lb[3], box_y + box_height)
width = box_x + box_width
height = bottom - top
shapes = f'''<g transform="translate(0 {-top:.3f})">
  <path fill="#F5F5F2" transform="translate({left_x:.3f} 0)" d="{left}"/>
  <rect x="{box_x:.3f}" y="{box_y:.3f}" width="{box_width:.3f}" height="{box_height:.3f}" rx="4" fill="#F49400"/>
  <path fill="#0D0D0D" transform="translate({right_x:.3f} 0)" d="{right}"/>
</g>'''
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.3f} {height:.3f}" role="img" aria-labelledby="title">
<title id="title">farmerrr.</title>
{shapes}
</svg>
'''
(OUT / 'farmerrr-wordmark.svg').write_text(svg, encoding='utf-8')
print(f'Exported outlined SVG: {width:.1f} x {height:.1f}')
