"""Prepare a licensed eye color source; never fetch Emily's image or mesh."""
from pathlib import Path
import hashlib, base64, json, shutil

here=Path(__file__).resolve().parent
assets=here/'assets';assets.mkdir(exist_ok=True)
source=assets/'grey_eye.png'
expected='ecb05613126036a3d017880fabbd570501c5f14032c186462d8f6e2d719f6c4f'
if not source.exists():
    original=Path('/tmp/eye-maps/eyes/materials/grey_eye.png')
    if not original.is_file():
        raise RuntimeError('The verified MakeHuman eye-source artifact must be downloaded before preparation')
    shutil.copyfile(original,source)
    shutil.copyfile(original.with_name('grey.mhmat'),assets/'grey.mhmat')
raw=source.read_bytes()
if hashlib.sha256(raw).hexdigest()!=expected:
    raise RuntimeError('Eye source checksum mismatch')
(here/'EyePhotoData.js').write_text('// MakeHuman system eye color source. CC0; see assets/SOURCE.json.\nexport const EYE_PHOTO_DATA='+json.dumps('data:image/png;base64,'+base64.b64encode(raw).decode())+';\n')
report={
 'asset':'MakeHuman system grey_eye.png','license':'CC0-1.0',
 'source':'https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip',
 'licenseEvidence':'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html',
 'archiveSHA256':'b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107',
 'imageSHA256':expected,'sourcePixels':[1024,1024],
 'sourceIrisDiameterPixels':230,'imageBytes':len(raw),
 'originalAuthor':'MakeHuman system assets; rights holders recorded in grey.mhmat',
 'usage':'One original color atlas, embedded without rescaling. Iris and sclera sampled in eye-local coordinates; pupil remapped at runtime. Color palettes are artistic adjustments.',
 'notEmilyTexture':True,'eyeGeometryImported':False
}
(assets/'SOURCE.json').write_text(json.dumps(report,indent=2))
print('EYE_TEXTURE_VERIFIED',json.dumps(report))
