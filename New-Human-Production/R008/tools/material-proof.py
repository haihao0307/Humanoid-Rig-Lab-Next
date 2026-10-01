import hashlib,json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=next((root/'qa/source-intake').glob('*.fbm'));result={}
for f in folder.glob('*.JPEG'):
 if not any(f.name.endswith('_'+key+'.JPEG') for key in ('basecolor','normal','roughness','metallic')):continue
 image=Image.open(f).convert('RGB');result[f.stem]={'size':image.size,'rgbSHA256':hashlib.sha256(image.tobytes()).hexdigest()}
json.dump(result,open(root/'qa/material-reference-hashes.json','w'),indent=2);print('Decoded material reference hashes:',len(result))
