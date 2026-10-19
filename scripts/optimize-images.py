"""Build responsive WebP assets from the preserved Figma PNG sources (Pillow 12+)."""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import hashlib
import json
import os

root = Path(__file__).resolve().parent.parent
artwork = root / 'public/images/artwork'
stage = root / '.asset-stage'
assert artwork.resolve().is_relative_to(root.resolve())
assert stage.resolve().is_relative_to(root.resolve())
stage.mkdir(exist_ok=False)
generated = []
report = []
try:
    for source in sorted(artwork.glob('*.png')):
        original = Image.open(source).convert('RGB')
        for width in (192, 384, 640):
            resized = original.resize((width, width), Image.Resampling.LANCZOS)
            target = stage / f'{source.stem}-{width}.webp'
            resized.save(target, format='WEBP', quality=95, method=6)
            generated.append(target)
            decoded = Image.open(target).convert('RGB')
            assert decoded.size == (width, width)
            deviation = sum(ImageStat.Stat(ImageChops.difference(resized, decoded)).mean) / 3
            assert deviation < 3.5, f'Unexpected visual deviation: {target.name}'
            report.append({'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'file': target.name, 'width': width, 'height': width, 'bytes': target.stat().st_size, 'quality': 95, 'meanAbsoluteChannelDifference': round(deviation, 4)})
    assert len(generated) == 12, 'Expected four original artworks and three responsive sizes each.'
    # All variants have decoded and passed checks before replacing the preceding set.
    for target in generated:
        os.replace(target, artwork / target.name)
    reports = root / 'reports'
    reports.mkdir(exist_ok=True)
    (reports / 'assets.json').write_text(json.dumps({'encoder': 'Pillow WebP quality 95, method 6; Lanczos resize', 'originalsPreserved': True, 'variants': report, 'totalBytes': sum(item['bytes'] for item in report)}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'variants': len(report), 'totalBytes': sum(item['bytes'] for item in report), 'maximumMeanDifference': max(item['meanAbsoluteChannelDifference'] for item in report)}))
finally:
    for target in generated:
        if target.exists():
            assert target.resolve().is_relative_to(stage.resolve())
            target.unlink()
    stage.rmdir()
