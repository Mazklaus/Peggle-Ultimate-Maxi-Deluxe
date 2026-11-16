import json, sys, math, glob
from PIL import Image, ImageDraw
pat = sys.argv[3] if len(sys.argv) > 3 else '*-*'
files = sorted(glob.glob(sys.argv[1] + '/' + pat + '.json'), key=lambda f: (f.split('/')[-1][:3] != 'pro', f))
S = 0.5; cols = 4; w, h = int(880*S), int(656*S)
img = Image.new('RGB', (cols*w, math.ceil(len(files)/cols)*h), (15, 20, 50)); d = ImageDraw.Draw(img)
for k, f in enumerate(files):
    lv = json.load(open(f)); ox, oy = (k % cols)*w, (k//cols)*h
    d.rectangle([ox, oy, ox+w-1, oy+h-1], outline=(80, 80, 140))
    d.text((ox+4, oy+4), f"{lv['id']} {lv['title']} ({len(lv['pegs'])})", fill=(255, 255, 255))
    d.ellipse([ox+440*S-6, oy-6, ox+440*S+6, oy+6], fill=(140, 147, 201))
    for p in lv['pegs']:
        x, y = ox+p['x']*S, oy+p['y']*S
        if p.get('shape') == 'brick':
            a = math.radians(p['angle']); dx, dy = math.cos(a)*p['w']/2*S, math.sin(a)*p['w']/2*S
            d.line([x-dx, y-dy, x+dx, y+dy], fill=(160, 160, 170), width=4)
        else:
            col = {'power': (90, 230, 170), 'heart': (255, 178, 63)}.get(p.get('kind'), (111, 203, 255))
            if p.get('group'): col = (230, 140, 255)
            d.ellipse([x-5, y-5, x+5, y+5], fill=col)
    for dd in lv.get('decor', []):
        if dd.get('type') in ('rotate', 'orbit'):
            cx, cy = ox+dd['cx']*S, oy+dd['cy']*S; d.ellipse([cx-3, cy-3, cx+3, cy+3], outline=(230, 140, 255))
img.save(sys.argv[2])
