import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = process.cwd()
const workDir = path.join(root, '.codex', 'store-screenshots-work')
const previewDir = path.join(workDir, 'preview')
await mkdir(previewDir, { recursive: true })

const slide = {
  screenshot: path.join(root, 'screenshots', 'screenshots_1.png'),
  headline: '정산을 게임처럼',
  subcopy: '금액과 친구만 고르면 끝',
}

const htmlPath = path.join(previewDir, '01-preview.html')
const outPath = path.join(previewDir, '01-preview-appstore-iphone-69.png')
const screenshotUrl = pathToFileURL(slide.screenshot).href

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1320px;
    height: 2868px;
    overflow: hidden;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    background:
      radial-gradient(circle at 18% 23%, rgba(255,255,255,.86) 0 13%, transparent 14%),
      linear-gradient(165deg, #f5f8ff 0%, #dceaff 44%, #2f80ed 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #142033;
  }
  .brand {
    margin-top: 118px;
    display: flex;
    align-items: center;
    gap: 18px;
    color: #1f7aff;
    font-size: 38px;
    font-weight: 800;
  }
  .mark {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(145deg, #2f80ed, #6eb6ff);
    box-shadow: 0 18px 45px rgba(47,128,237,.28);
    position: relative;
  }
  .mark::after {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    left: 15px;
    top: 15px;
    border-radius: 50%;
    background: #fff;
  }
  .copy {
    margin-top: 72px;
    text-align: center;
    padding: 0 96px;
  }
  h1 {
    font-size: 120px;
    line-height: 1.13;
    font-weight: 900;
    letter-spacing: 0;
    color: #126dff;
  }
  p {
    margin-top: 32px;
    font-size: 50px;
    line-height: 1.35;
    font-weight: 700;
    color: rgba(20,32,51,.72);
  }
  .device {
    margin-top: 150px;
    width: 1008px;
    aspect-ratio: 1320 / 2868;
    background: #101014;
    border-radius: 145px;
    padding: 24px;
    box-shadow: 0 90px 180px rgba(20, 74, 142, .38), inset 0 0 0 5px #3b3d45;
    position: relative;
    transform: rotate(-2deg);
  }
  .screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    border-radius: 121px;
    display: block;
  }
  .island {
    position: absolute;
    top: 52px;
    left: 50%;
    transform: translateX(-50%);
    width: 270px;
    height: 78px;
    border-radius: 44px;
    background: #050507;
  }
  .glow {
    position: absolute;
    right: -150px;
    bottom: 450px;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background: rgba(255,255,255,.3);
    filter: blur(2px);
  }
</style>
</head>
<body>
  <div class="brand"><span class="mark"></span><span>누가낼래</span></div>
  <section class="copy">
    <h1>${slide.headline}</h1>
    <p>${slide.subcopy}</p>
  </section>
  <div class="device">
    <img class="screen" src="${screenshotUrl}" alt="">
    <div class="island"></div>
  </div>
  <div class="glow"></div>
</body>
</html>`

await writeFile(htmlPath, html, 'utf8')

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const result = spawnSync(chrome, [
  '--headless=new',
  `--screenshot=${outPath}`,
  '--window-size=1320,2868',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  '--virtual-time-budget=2000',
  pathToFileURL(htmlPath).href,
], { stdio: 'inherit' })

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(outPath)
