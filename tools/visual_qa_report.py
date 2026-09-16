from __future__ import annotations

import contextlib
import html
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageStat
from selenium import webdriver
from selenium.webdriver.common.by import By

from visual_qa_core import body_state, switch_body, utc_now

VIEW_LABELS = {"front":"正面","side":"侧面","back":"背面","top":"俯视"}


def json_dump(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def image_metrics(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        rgb = image.convert("RGB"); stat = ImageStat.Stat(rgb); sample = rgb.resize((96,64))
        variance = sum(ImageStat.Stat(sample).var)/3.0; mean = sum(stat.mean)/3.0
        return {"width":rgb.width,"height":rgb.height,"meanLumaApprox":mean,"varianceApprox":variance,
          "extrema":rgb.getextrema(),"looksBlank":variance<2.0 or mean<1.5}


def capture_canvas(driver: webdriver.Chrome, path: Path, metadata: dict[str, Any], manifest: list[dict[str, Any]], root: Path) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    switch_body(driver); driver.find_element(By.ID,"view").screenshot(str(path)); driver.switch_to.default_content()
    entry = {"file":path.relative_to(root).as_posix(),"capturedAt":utc_now(),**metadata,"image":image_metrics(path)}
    manifest.append(entry); return entry


def make_crops(source: Path, manifest: list[dict[str, Any]], metadata: dict[str, Any], root: Path) -> list[str]:
    outputs=[]
    with Image.open(source) as image:
        image=image.convert("RGB"); w,h=image.size
        for name,box in {"shoulder":(int(w*.18),int(h*.12),int(w*.82),int(h*.56)),"feet":(int(w*.16),int(h*.67),int(w*.84),h)}.items():
            target=source.with_name(source.stem+f"--{name}"+source.suffix); image.crop(box).save(target)
            rel=target.relative_to(root).as_posix(); outputs.append(rel)
            manifest.append({"file":rel,"capturedAt":utc_now(),**metadata,"derivedCrop":name,
              "source":source.relative_to(root).as_posix(),"image":image_metrics(target)})
    return outputs


def make_contact_sheet(root: Path, manifest: list[dict[str, Any]]) -> str | None:
    items=[x for x in manifest if str(x.get("stage","")).endswith("mid") and not x.get("derivedCrop")]
    if not items:
        items=[x for x in manifest if x.get("scenario")=="baseline" and x.get("anatomy")=="skin"]
    if not items:
        return None
    tw,th,label,cols=400,260,42,3; rows=math.ceil(len(items)/cols)
    sheet=Image.new("RGB",(cols*tw,rows*(th+label)),(16,21,28)); draw=ImageDraw.Draw(sheet); font=ImageFont.load_default()
    for candidate in ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc","/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(candidate).exists():
            with contextlib.suppress(Exception): font=ImageFont.truetype(candidate,16); break
    for i,item in enumerate(items):
        x=(i%cols)*tw; y=(i//cols)*(th+label)
        with Image.open(root/item["file"]) as image:
            image=image.convert("RGB"); image.thumbnail((tw-8,th-8)); sheet.paste(image,(x+(tw-image.width)//2,y+(th-image.height)//2))
        draw.rectangle((x,y+th,x+tw,y+th+label),fill=(24,33,43))
        text=f"{item.get('scenario')} | {VIEW_LABELS.get(item.get('view'),item.get('view'))} | {item.get('stage')}"
        draw.text((x+8,y+th+10),text[:58],fill=(221,233,239),font=font)
    path=root/"contact-sheet.png"; sheet.save(path); return path.relative_to(root).as_posix()


def build_review_html(root: Path, report: dict[str, Any]) -> None:
    baseline=[]
    for item in report.get("baseline",[]):
        baseline.append(f'<figure><img loading="lazy" src="{html.escape(item["file"])}"><figcaption>{html.escape(item.get("anatomy",""))} · {html.escape(VIEW_LABELS.get(item.get("view"),item.get("view","")))}</figcaption></figure>')
    sections=[]
    for scenario in report.get("scenarios",[]):
        views=[]
        for view in scenario.get("views",[]):
            media=[]
            if view.get("video"): media.append(f'<video controls preload="metadata" src="{html.escape(view["video"])}"></video>')
            for step in view.get("steps",[]):
                for label,key in (("中段","mid"),("完成","end")):
                    entry=step.get(key)
                    if entry: media.append(f'<figure><img loading="lazy" src="{html.escape(entry["file"])}"><figcaption>{label} · {html.escape(step.get("command",""))}</figcaption></figure>')
                for crop in step.get("midCrops",[]): media.append(f'<figure class="crop"><img loading="lazy" src="{html.escape(crop)}"><figcaption>真实截图裁切</figcaption></figure>')
            state="通过数值完成" if view.get("completed") else "需复核/失败"
            views.append(f'<article><h3>{VIEW_LABELS.get(view.get("view"),view.get("view"))} <span class="{ "ok" if view.get("completed") else "warn" }">{state}</span></h3><div class="grid">{"".join(media)}</div></article>')
        sections.append(f'<section><header><h2>{html.escape(scenario.get("title",scenario.get("id","")))}</h2><span class="badge">{ "完成" if scenario.get("completed") else "需要检查" }</span></header><p>{html.escape(scenario.get("note",""))}</p>{"".join(views)}</section>')
    pre=report.get("preflight",{}); contact=report.get("contactSheet")
    page=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>人物动作自动视觉验收</title><style>
:root{{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;background:#0b1118;color:#e7edf2}}*{{box-sizing:border-box}}body{{margin:0}}main{{max-width:1560px;margin:auto;padding:24px}}p,li{{color:#aebcc8;line-height:1.65}}code{{color:#a8e5dd}}.summary,.grid,.baseline{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}}.metric,section{{background:#101923;border:1px solid #273744;border-radius:14px;padding:15px;margin:15px 0}}section>header{{display:flex;justify-content:space-between;align-items:center}}figure,video{{margin:0;width:100%;background:#070b10;border:1px solid #2b3b48;border-radius:10px;overflow:hidden}}img,video{{width:100%;display:block}}figcaption{{padding:7px 9px;font-size:12px;color:#a6b7c3}}.badge,.ok,.warn{{padding:4px 8px;border-radius:999px;font-size:12px}}.badge,.ok{{background:#183d35;color:#9de2c9}}.warn{{background:#493024;color:#ffd19c}}.flags{{border:1px solid #6d4c29;background:#2c2118;border-radius:10px;padding:12px;color:#ffd5a4}}.contact{{width:100%;border:1px solid #304454;border-radius:10px}}a{{color:#86d9ff}}</style></head><body><main>
<h1>人物动作自动视觉验收</h1><p>固定来源提交 <code>{html.escape(report.get("sourceSHA",""))}</code>。画面来自同一真实 Chrome 会话；自动截图不代表用户批准。</p><div class="flags">visualAcceptance=false · productionReady=false · userVisualAcceptance=pending</div>
<div class="summary"><div class="metric"><b>预检</b><br>{'通过' if pre.get('passed') else '失败'}</div><div class="metric"><b>固定 HTTPS</b><br>{html.escape(report.get('testedURL',''))}</div><div class="metric"><b>WebGL2</b><br>{html.escape(str(pre.get('body',{}).get('renderer')))}</div><div class="metric"><b>场景</b><br>{len(report.get('scenarios',[]))} 组</div></div>
<h2>基线：皮肤 / 素模 / 骨骼</h2><div class="baseline">{''.join(baseline)}</div>{f'<h2>Contact Sheet</h2><img class="contact" src="{html.escape(contact)}">' if contact else ''}{''.join(sections)}
<h2>证据文件</h2><ul><li><a href="browser-run-report.json">browser-run-report.json</a></li><li><a href="screenshot-manifest.json">screenshot-manifest.json</a></li><li><a href="browser-console.json">browser-console.json</a></li></ul></main></body></html>'''
    (root/"visual-review.html").write_text(page,encoding="utf-8")
