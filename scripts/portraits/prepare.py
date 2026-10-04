"""Prepare real photos as NPC portraits and link them into a storyline.

Usage:
  python3 scripts/portraits/prepare.py <photos-dir> [storyline]

<photos-dir> holds one photo per person, named by person id (ron.jpg, sheila.png, ...).
Optional mood variants: ron.happy.jpg, ron.concerned.jpg, ... (happy, neutral, thinking,
concerned, frustrated), per the GenieKreator Configuration Spec expression set.

Each photo is centre cropped to the 4:5 head and shoulders frame the board uses (faces sit in the
top third), resized to 480x600, and saved to public/assets/npc/<id>[.<mood>].jpg. The storyline's
`portrait` and `portraits` fields are then set for every person with a file. Calibration values are
left untouched (unlike re-running the 1.0 importer).
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/npc'
MOODS = ['happy', 'neutral', 'thinking', 'concerned', 'frustrated']
W, H = 480, 600

def prepare(src: Path, dst: Path):
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w, h = img.size
    if w / h > W / H:  # too wide: crop the sides around the centre
        nw = round(h * W / H); left = (w - nw) // 2
        img = img.crop((left, 0, left + nw, h))
    else:  # too tall: keep the top, where the face is
        nh = round(w * H / W); top = min((h - nh) // 4, h - nh)
        img = img.crop((0, top, w, top + nh))
    img.resize((W, H), Image.LANCZOS).save(dst, 'JPEG', quality=86, optimize=True, progressive=True)

def main():
    photos = Path(sys.argv[1])
    story = ROOT / 'src/engine/storylines' / f"{sys.argv[2] if len(sys.argv) > 2 else 'sales-elevator'}.json"
    data = json.loads(story.read_text())
    people = data['members'] + data['candidates']
    sponsor_id = data['sponsor']['name'].split(' ')[0].lower()
    ids = {p['id'] for p in people} | {sponsor_id}
    done = {}
    for f in sorted(photos.iterdir()):
        if f.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        pid, _, mood = f.stem.partition('.')
        if pid not in ids or (mood and mood not in MOODS):
            print(f'skip {f.name}: unknown person or mood'); continue
        name = f'{pid}.{mood}.jpg' if mood else f'{pid}.jpg'
        prepare(f, OUT / name)
        done.setdefault(pid, {})[mood or ''] = f'/assets/npc/{name}'
    if sponsor_id in done and '' in done[sponsor_id]:
        data['sponsor']['portrait'] = done[sponsor_id]['']
    for p in people:
        got = done.get(p['id'])
        if not got: continue
        if '' in got: p['portrait'] = got['']
        moods = {m: v for m, v in got.items() if m}
        if moods: p['portraits'] = {**p.get('portraits', {}), **moods}
    story.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    missing = [p['id'] for p in people if not p.get('portrait')]
    print(f'{len(done)} people updated in {story.name}. Still without a portrait: {", ".join(missing) or "none"}')

if __name__ == '__main__':
    main()
