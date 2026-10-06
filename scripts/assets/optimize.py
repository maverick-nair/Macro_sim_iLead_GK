"""Compressed variants of the app's static assets (M8, D78), so the first load stays inside the Web Vitals budgets.

Usage:
  python3 scripts/assets/optimize.py           write the variants next to the sources in public/
  python3 scripts/assets/optimize.py --check   fail when a variant is missing
  python3 scripts/assets/optimize.py --force   rewrite every variant (after replacing a source)

- Fonts: every public/fonts/*.ttf gets a .woff2 (needs `pip install fonttools brotli`). The app loads only
  the WOFF2 files; the TTFs stay for the design prototype the parity check renders.
- Portraits: every public/assets/npc/*.png and *.jpg gets a .webp at the same size (quality 82). Storylines
  point at the .webp; the PNGs stay for the design gallery and the prototype.
- Backdrops: public/assets/bg-*.png get a .webp (quality 80) at the source size.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'public'


def jobs():
    for ttf in sorted((PUBLIC / 'fonts').glob('*.ttf')):
        yield ttf, ttf.with_suffix('.woff2'), 'font', None
    for img in sorted([*(PUBLIC / 'assets/npc').glob('*.png'), *(PUBLIC / 'assets/npc').glob('*.jpg')]):
        yield img, img.with_suffix('.webp'), 'image', 82
    for img in sorted((PUBLIC / 'assets').glob('bg-*.png')):
        yield img, img.with_suffix('.webp'), 'image', 80


def make(src: Path, dst: Path, kind: str, quality):
    if kind == 'font':
        from fontTools.ttLib import TTFont
        font = TTFont(src)
        font.flavor = 'woff2'
        font.save(dst)
    else:
        from PIL import Image
        img = Image.open(src)
        img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
        img.save(dst, 'WEBP', quality=quality, method=6)


def main():
    check = '--check' in sys.argv
    stale = []
    for src, dst, kind, quality in jobs():
        if dst.exists() and '--force' not in sys.argv:
            continue
        if check:
            stale.append(str(dst.relative_to(ROOT)))
            continue
        make(src, dst, kind, quality)
        print(f'{dst.relative_to(ROOT)}  {src.stat().st_size // 1024} KB -> {dst.stat().st_size // 1024} KB')
    if stale:
        print('Missing: ' + ', '.join(stale) + '. Run python3 scripts/assets/optimize.py.')
        sys.exit(1)


if __name__ == '__main__':
    main()
