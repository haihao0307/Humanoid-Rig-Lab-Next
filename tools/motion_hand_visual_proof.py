#!/usr/bin/env python3
"""Real-browser hand-action proof for the current motion convergence branch.

The runner executes the exact generated body runtime in Chrome. It captures the
whole canvas and a dynamically projected crop around the relevant hand chain.
The fallback surface is motion evidence only: it does not approve skin quality,
full dynamics, or temporal naturalness from a single frame.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import math
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageDraw, ImageFont
from selenium import webdriver
from selenium.webdriver.common.by import By


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        binary = shutil.which(name)
        if binary:
            options.binary_location = binary
            break
    for arg in (
        "--window-size=1720,980", "--window-position=0,0", "--no-sandbox",
        "--disable-dev-shm-usage", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle",
        "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader",
        "--force-device-scale-factor=1", "--lang=zh-CN",
    ):
        options.add_argument(arg)
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(1720, 980)
    driver.set_page_load_timeout(120)
    return driver


def wait(predicate: Callable[[], Any], timeout: float, message: str, interval: float = .05) -> Any:
    deadline = time.time() + timeout
    last: Any = None
    while time.time() < deadline:
        try:
            last = predicate()
            if last:
                return last
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
        time.sleep(interval)
    raise TimeoutError(f"{message}; last={last!r}")


def enter_body(driver: webdriver.Chrome) -> str:
    driver.switch_to.default_content()
    frames = driver.find_elements(By.ID, "bodyFrame")
    if frames:
        driver.switch_to.frame(frames[0])
        return "iframe"
    if driver.find_elements(By.ID, "view"):
        return "direct"
    raise RuntimeError("未找到人物画布")


def body_script(driver: webdriver.Chrome, script: str, *args: Any) -> Any:
    enter_body(driver)
    try:
        return driver.execute_script(script, *args)
    finally:
        driver.switch_to.default_content()


def snapshot(driver: webdriver.Chrome) -> dict[str, Any]:
    mode = enter_body(driver)
    value = driver.execute_script(
        """
        const text=id=>document.getElementById(id)?.textContent?.trim()||null;
        const lab=globalThis.lab||globalThis.__HUMAN_LAB__||globalThis.HumanLab||null;
        const agent=lab?.agent||null, renderer=lab?.renderer||null;
        const screenJoint=id=>{
          try{const j=lab?.h?.byId?.get?.(id);if(!j)return null;const s=renderer?.screen?.(j.world.p)||null;
          return {world:[...j.world.p],screen:s&&Number.isFinite(s.x)&&Number.isFinite(s.y)?{x:s.x,y:s.y,visible:!!s.visible}:null};}catch(error){return {error:String(error)}}
        };
        const screenObject=id=>{
          try{const o=lab?.w?.get?.(id)||lab?.w?.objects?.find?.(x=>x.id===id);if(!o)return null;
          const s=renderer?.screen?.(o.p)||null;return {world:o.p?[...o.p]:null,screen:s&&Number.isFinite(s.x)&&Number.isFinite(s.y)?{x:s.x,y:s.y,visible:!!s.visible}:null};}catch(error){return {error:String(error)}}
        };
        let locomotion=null,activity=null,diagnostics=null,pose=null,basic=null;
        try{locomotion=agent?.locomotion?.report?.()||null;}catch(error){locomotion={error:String(error)}}
        try{activity=agent?.activity?.()||null;}catch(error){activity={error:String(error)}}
        try{diagnostics=agent?.diagnostics?.()||null;}catch(error){diagnostics={error:String(error)}}
        try{pose=lab?.h?.motionDriver?.report?.()||null;}catch(error){pose={error:String(error)}}
        try{basic=agent?.basic?.report?.()||null;}catch(error){basic={error:String(error)}}
        const canvas=document.getElementById('view');let gl=null;try{gl=canvas?.getContext('webgl2')}catch(error){}
        const skill=agent?.skill?Object.fromEntries(['type','objectId','targetId','relation','duration'].map(k=>[k,agent.skill[k]])):null;
        return {
          readyState:document.readyState,loadingHidden:document.getElementById('loading')?.hidden===true,
          canvas:{width:canvas?.width||0,height:canvas?.height||0,clientWidth:canvas?.clientWidth||0,clientHeight:canvas?.clientHeight||0},
          webgl2:!!gl,contextLost:gl?.isContextLost?.()??null,
          phase:agent?.phase||text('phase'),phaseT:Number(agent?.phaseT||0),phaseWallT:Number(agent?.phaseWallT||0),
          posture:text('posture'),done:text('done'),log:text('log'),error:agent?.error||null,skill,
          held:agent?.held?.id||null,readyForTask:activity?.readyForTask===true||diagnostics?.activity?.readyForTask===true,
          locomotion,activity,diagnostics,pose,basic,
          points:{
            head:screenJoint('head'),neck:screenJoint('neck'),chest:screenJoint('chest'),hips:screenJoint('hips'),
            leftUpperArm:screenJoint('left_upperArm'),leftForearm:screenJoint('left_forearm'),leftHand:screenJoint('left_hand'),
            rightUpperArm:screenJoint('right_upperArm'),rightForearm:screenJoint('right_forearm'),rightHand:screenJoint('right_hand'),
            A:screenObject('A'),B:screenObject('B')
          }
        };
        """
    )
    driver.switch_to.default_content()
    value["bodyMode"] = mode
    return value


def done_count(value: dict[str, Any]) -> int:
    digits = "".join(ch for ch in str(value.get("done") or "") if ch.isdigit())
    return int(digits or 0)


def load_ready(driver: webdriver.Chrome, url: str) -> dict[str, Any]:
    driver.get(url)
    wait(lambda: driver.execute_script("return document.readyState==='complete'"), 60, "页面没有完成加载", .12)
    return wait(
        lambda: (lambda s: s if s.get("loadingHidden") and s.get("canvas",{}).get("width",0)>500 and s.get("webgl2") and not s.get("contextLost") and s.get("locomotion") else None)(snapshot(driver)),
        150, "人物运行时没有完成首帧", .2,
    )


def set_view(driver: webdriver.Chrome, view: str, follow: bool = False) -> None:
    result = body_script(
        driver,
        """
        const menu=document.getElementById('bodyView'),target=document.getElementById(arguments[0]),follow=document.getElementById('follow');
        if(!menu||!target||!follow)throw new Error('人物镜头控件缺失');
        if(follow.checked!==arguments[1])follow.click();menu.click();target.click();
        return {view:target.id,follow:follow.checked};
        """, view, follow,
    )
    if result.get("view") != view:
        raise RuntimeError(f"镜头切换失败：{result}")
    time.sleep(.65)


def reset(driver: webdriver.Chrome) -> dict[str, Any]:
    body_script(
        driver,
        """
        const reset=document.getElementById('reset'),pause=document.getElementById('pause'),bodyView=document.getElementById('bodyView');
        if(!reset)throw new Error('恢复人物控件缺失');reset.click();
        if(pause&&/继续/.test(pause.textContent||''))pause.click();bodyView?.click();
        """,
    )
    time.sleep(.9)
    return wait(lambda:(lambda s:s if '站' in (s.get('posture') or '') and s.get('readyForTask') else None)(snapshot(driver)),40,"恢复人物后未进入可执行站姿",.15)


def send(driver: webdriver.Chrome, text: str) -> int:
    before = done_count(snapshot(driver))
    result = body_script(
        driver,
        """
        const field=document.getElementById('command'),send=document.getElementById('send');
        if(!field||!send)throw new Error('任务输入控件缺失');field.value=String(arguments[0]);
        field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));send.click();
        return {value:field.value,disabled:send.disabled===true};
        """, text,
    )
    if result.get("value") != text:
        raise RuntimeError(f"任务没有写入：{result}")
    return before


def get_font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def annotate(image: Image.Image, label: str, subtitle: str = "") -> Image.Image:
    bar = 76 if subtitle else 54
    out = Image.new("RGB", (image.width, image.height + bar), "#10161d")
    out.paste(image.convert("RGB"), (0, bar))
    draw = ImageDraw.Draw(out)
    draw.text((18, 8), label, fill="#f0f5f7", font=get_font(26))
    if subtitle:
        draw.text((18, 42), subtitle, fill="#a9c3cc", font=get_font(16))
    return out


def point_xy(state: dict[str, Any], name: str) -> tuple[float,float] | None:
    item = state.get("points",{}).get(name) or {}
    screen = item.get("screen") or {}
    if screen.get("visible") and math.isfinite(screen.get("x",math.nan)) and math.isfinite(screen.get("y",math.nan)):
        return float(screen["x"]), float(screen["y"])
    return None


def capture(driver: webdriver.Chrome, root: Path, stem: str, label: str, point_names: list[str], subtitle: str = "") -> dict[str, Any]:
    state = snapshot(driver)
    root.mkdir(parents=True, exist_ok=True)
    raw_path = root / f"{stem}--full-raw.png"
    enter_body(driver); canvas = driver.find_element(By.ID,"view"); canvas.screenshot(str(raw_path)); driver.switch_to.default_content()
    image = Image.open(raw_path).convert("RGB")
    client = state.get("canvas",{}); sx=image.width/max(1,float(client.get("clientWidth") or image.width)); sy=image.height/max(1,float(client.get("clientHeight") or image.height))
    points=[]
    for name in point_names:
        p=point_xy(state,name)
        if p: points.append((p[0]*sx,p[1]*sy))
    if points:
        xs=[p[0] for p in points];ys=[p[1] for p in points]
        margin_x=max(150,min(300,(max(xs)-min(xs))*.45+120));margin_y=max(150,min(280,(max(ys)-min(ys))*.55+115))
        box=(max(0,int(min(xs)-margin_x)),max(0,int(min(ys)-margin_y)),min(image.width,int(max(xs)+margin_x)),min(image.height,int(max(ys)+margin_y)))
        if box[2]-box[0]<420:
            cx=(box[0]+box[2])//2;box=(max(0,cx-210),box[1],min(image.width,cx+210),box[3])
        if box[3]-box[1]<360:
            cy=(box[1]+box[3])//2;box=(box[0],max(0,cy-180),box[2],min(image.height,cy+180))
        close=image.crop(box)
    else:
        w,h=image.size;close=image.crop((int(w*.20),int(h*.08),int(w*.80),int(h*.88)))
    full=annotate(image,label,subtitle);close=annotate(close,label+"｜手部近景",subtitle)
    full_path=root/f"{stem}--full.png";close_path=root/f"{stem}--hand.png"
    full.save(full_path);close.save(close_path)
    image.close();full.close();close.close()
    return {"id":stem,"label":label,"subtitle":subtitle,"full":full_path.name,"hand":close_path.name,"raw":raw_path.name,"state":state,"capturedAt":utc_now()}


def phase_wait(driver: webdriver.Chrome, phases: set[str], minimum_t: float, timeout: float, message: str) -> dict[str, Any]:
    return wait(lambda:(lambda s:s if s.get('phase') in phases and float(s.get('phaseT') or 0)>=minimum_t else None)(snapshot(driver)),timeout,message,.06)


def safe_capture_failure(driver: webdriver.Chrome, root: Path, stem: str, label: str, names: list[str], error: Exception) -> dict[str, Any]:
    item=capture(driver,root,stem,label,names,f"未完成：{type(error).__name__}: {error}")
    item["completed"]=False;item["error"]=f"{type(error).__name__}: {error}";return item


def make_sheet(root: Path, captures: list[dict[str, Any]]) -> str:
    cards=[]
    for item in captures:
        path=root/item["hand"]
        with Image.open(path) as source:
            image=source.convert("RGB");image.thumbnail((760,500))
            card=Image.new("RGB",(800,540),"#111820");card.paste(image,((800-image.width)//2,20))
            draw=ImageDraw.Draw(card);status="完成抓取" if item.get("completed",True) else "保留失败证据"
            draw.text((18,505),status,fill="#b9d8cc" if item.get("completed",True) else "#f0b7a8",font=get_font(18));cards.append(card)
    rows=(len(cards)+1)//2;sheet=Image.new("RGB",(1600,max(1,rows)*540),"#0b1016")
    for i,card in enumerate(cards):sheet.paste(card,((i%2)*800,(i//2)*540))
    output=root/"hand-actions-contact-sheet.jpg";sheet.save(output,quality=92);return output.name


def write_review(root: Path, report: dict[str, Any]) -> None:
    cards=[]
    for item in report["captures"]:
        cards.append(f"<article><h2>{item['label']}</h2><p>{item.get('subtitle','')}</p><img src='{item['hand']}'><details><summary>全画面</summary><img src='{item['full']}'></details><pre>{json.dumps({'phase':item['state'].get('phase'),'phaseT':item['state'].get('phaseT'),'skill':item['state'].get('skill'),'held':item['state'].get('held'),'error':item['state'].get('error'),'pose':item['state'].get('pose')},ensure_ascii=False,indent=2)}</pre></article>")
    html=f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>人物手部动作浏览器证据</title><style>body{{margin:0;background:#0b1016;color:#e8eef0;font:15px/1.55 system-ui;padding:24px}}a{{color:#8bc9ff}}.summary,article{{background:#151d25;border:1px solid #2c3945;border-radius:14px;padding:18px;margin-bottom:20px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:20px}}img{{max-width:100%;height:auto;background:#05080b}}pre{{white-space:pre-wrap;overflow:auto;color:#bfd8e3}}</style></head><body><h1>人物动作收敛｜手部动作真实浏览器测试</h1><section class='summary'><p>源提交：<code>{report['sourceSHA']}</code></p><p>状态：<strong>{report['status']}</strong></p><p>范围：挥手、敬礼、打招呼、坐起撑地、抓取前伸、箱底承托、双掌推动。静帧不能证明时间连续性；失败动作保留实际阻断，不伪造完成。</p><p><a href='{report['interactiveURL']}'>打开精确提交三维工作台</a></p><img src='{report['contactSheet']}'></section><div class='grid'>{''.join(cards)}</div></body></html>"""
    (root/"visual-review.html").write_text(html,encoding="utf-8")


def main() -> int:
    parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--source-sha',required=True);parser.add_argument('--interactive-url',required=True);parser.add_argument('--output',default='hand-proof');args=parser.parse_args()
    root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
    report={"schema":"human/motion_hand_browser_proof@1","sourceSHA":args.source_sha,"testedURL":args.url,"interactiveURL":args.interactive_url,"startedAt":utc_now(),"status":"INCONCLUSIVE","captures":[],"scenarioFailures":[],"surfaceReviewScope":"motion-preview-lightweight-fallback","skinApproval":False,"fullDynamics":False,"visualAcceptance":False,"userVisualAcceptance":"pending"}
    driver=None
    try:
        driver=make_driver();initial=load_ready(driver,args.url);report["bodyMode"]=initial.get("bodyMode")
        # Standing gestures share one deterministic session.
        for stem,label,command_text,phase_name,delay,names,view in (
            ("01-wave","挥手","挥手","wave",1.25,["rightUpperArm","rightForearm","rightHand","head"],"front"),
            ("02-salute","敬礼","敬礼","salute",.80,["rightUpperArm","rightForearm","rightHand","head"],"front"),
            ("03-greet","打招呼","打招呼","greet",.75,["rightUpperArm","rightForearm","rightHand","leftHand","head"],"front"),
        ):
            try:
                reset(driver);set_view(driver,view,False);send(driver,command_text);phase_wait(driver,{phase_name},delay,25,f"没有观察到{label}阶段")
                item=capture(driver,root,stem,label,names,"同一人物、固定镜头的动作中段");item["completed"]=True;report["captures"].append(item)
            except Exception as exc:
                report["scenarioFailures"].append(stem);report["captures"].append(safe_capture_failure(driver,root,stem,label,names,exc))

        # Ground palm support during stand-up transition.
        try:
            reset(driver);set_view(driver,"side",False);before=send(driver,"坐下")
            wait(lambda:(lambda s:s if done_count(s)>before and '坐' in (s.get('posture') or '') else None)(snapshot(driver)),55,"坐下没有稳定完成",.15)
            send(driver,"起身")
            ground=wait(lambda:(lambda s:s if s.get('phase') in {'standPrepare','standUp'} and ((s.get('pose') or {}).get('floorSupport') or float(s.get('phaseT') or 0)>.45) else None)(snapshot(driver)),35,"没有观察到坐起手掌支撑",.05)
            item=capture(driver,root,"04-floor-palm-support","坐起撑地",["rightHand","rightForearm","rightUpperArm","hips"],f"阶段 {ground.get('phase')}｜地面手掌支撑候选");item["completed"]=True;report["captures"].append(item)
        except Exception as exc:
            report["scenarioFailures"].append("04-floor-palm-support");report["captures"].append(safe_capture_failure(driver,root,"04-floor-palm-support","坐起撑地",["rightHand","rightForearm","hips"],exc))

        # Reload before object manipulation so no retained support/contact state leaks across tests.
        load_ready(driver,args.url);reset(driver);set_view(driver,"side",True)
        try:
            send(driver,"把A搬到一区")
            phase_wait(driver,{"reach"},.95,95,"没有观察到搬箱前伸抓取阶段")
            item=capture(driver,root,"05-reach-box","前伸抓取",["leftUpperArm","leftForearm","leftHand","rightUpperArm","rightForearm","rightHand","A"],"搬箱流程的双手接近阶段");item["completed"]=True;report["captures"].append(item)
            support=phase_wait(driver,{"boxPickup","lift","travel"},.18,75,"没有进入箱边倾转或底托阶段")
            item=capture(driver,root,"06-box-bottom-support","箱体底托/换手",["leftForearm","leftHand","rightForearm","rightHand","A","hips"],f"实际阶段 {support.get('phase')}｜不以放宽腕关节伪造完成");item["completed"]=True;report["captures"].append(item)
        except Exception as exc:
            report["scenarioFailures"].append("05-06-carry");report["captures"].append(safe_capture_failure(driver,root,"06-carry-blocked","搬箱手部阻断",["leftHand","rightHand","A","hips"],exc))

        load_ready(driver,args.url);reset(driver);set_view(driver,"side",True)
        try:
            send(driver,"把B推到二区")
            push=phase_wait(driver,{"pushTravel"},.25,110,"没有进入双掌持续推动阶段")
            item=capture(driver,root,"07-push-two-palms","双掌推动",["leftUpperArm","leftForearm","leftHand","rightUpperArm","rightForearm","rightHand","B"],f"实际阶段 {push.get('phase')}｜双掌接触与全身支撑共同检查");item["completed"]=True;report["captures"].append(item)
        except Exception as exc:
            report["scenarioFailures"].append("07-push-two-palms");report["captures"].append(safe_capture_failure(driver,root,"07-push-two-palms","双掌推动",["leftHand","rightHand","B","hips"],exc))

        report["contactSheet"]=make_sheet(root,report["captures"]);report["status"]="CAPTURED_WITH_FAILURES" if report["scenarioFailures"] else "CAPTURED";report["finishedAt"]=utc_now();write_review(root,report)
        (root/"browser-run-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        logs=driver.get_log('browser');(root/"browser-console.json").write_text(json.dumps(logs,ensure_ascii=False,indent=2),encoding="utf-8")
        return 0
    except Exception as exc:
        report["runnerError"]={"type":type(exc).__name__,"message":str(exc)};report["finishedAt"]=utc_now()
        (root/"browser-run-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        if driver:
            with contextlib.suppress(Exception):driver.save_screenshot(str(root/"runner-failure-window.png"))
        return 1
    finally:
        if driver:
            with contextlib.suppress(Exception):driver.quit()


if __name__=='__main__':raise SystemExit(main())
