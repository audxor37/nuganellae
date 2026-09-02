import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = process.cwd()
const workDir = path.join(root, '.codex', 'store-screenshots-work')
const htmlDir = path.join(workDir, 'html')
const outputRoot = path.join(root, 'store-screenshots')
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const slides = [
  ['screenshots_1.png', '정산을 게임처럼', '금액과 친구만 고르면 끝'],
  ['screenshots_2.png', '모임 이름부터', '기록도 깔끔하게 남겨요'],
  ['screenshots_3.png', '금액 입력도 빠르게', '버튼으로 바로 더해요'],
  ['screenshots_4.png', '참여자를 쉽게 추가', '최대 8명까지 함께'],
  ['screenshots_5.png', '원하는 방식대로', '한 명 면제부터 골고루까지'],
  ['screenshots_6.png', '순발력으로 승부', '숫자를 빠르게 눌러요'],
  ['screenshots_7.png', '기억력 게임까지', '카드 위치를 맞춰요'],
  ['screenshots_8.png', '순위가 바로 정리', '결과를 한눈에 확인'],
  ['screenshots_9.png', '정산이 완료됐어요', '누가 얼마 낼지 바로 확인'],
  ['screenshots_10.png', '결과 공유도 간편하게', '이미지와 링크로 전달'],
]

const targets = [
  { id: 'appstore-iphone-69', width: 636, height: 1048, platform: 'ios' },
  { id: 'appstore-iphone-65', width: 636, height: 1048, platform: 'ios' },
  { id: 'play-phone', width: 636, height: 1048, platform: 'android' },
]

function px(value, target) {
  return `${Math.round(value * target.width / 1320)}px`
}

function htmlFor(slide, index, target) {
  const [file, headline, subcopy] = slide
  const screenshotUrl = pathToFileURL(path.join(root, 'screenshots', file)).href
  const isPlay = target.platform === 'android'
  const deviceWidth = target.width * 0.53
  const aspect = isPlay ? '1080 / 2340' : '1320 / 2868'
  const radius = isPlay ? deviceWidth * 0.07 : deviceWidth * 0.144
  const padding = isPlay ? deviceWidth * 0.017 : deviceWidth * 0.024
  const rotation = index % 2 === 0 ? '-2deg' : '2deg'
  const bodyBg = [
    'radial-gradient(circle at 16% 22%, rgba(255,255,255,.82) 0 13%, transparent 14%)',
    'radial-gradient(circle at 84% 77%, rgba(255,255,255,.22) 0 15%, transparent 16%)',
    'linear-gradient(165deg, #f7faff 0%, #dceaff 44%, #2f80ed 100%)',
  ].join(',')

  const topOffset = target.height * 0.031
  const headlineSize = 49
  const subcopySize = 22
  const brandSize = 18
  const copyTop = 31
  const deviceTop = 41

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${target.width}px;
    height: ${target.height}px;
    overflow: hidden;
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    background: ${bodyBg};
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #142033;
  }
  .brand {
    margin-top: ${Math.round(topOffset)}px;
    display: flex;
    align-items: center;
    gap: ${px(18, target)};
    color: #1f7aff;
    font-size: ${brandSize}px;
    font-weight: 800;
  }
  .mark {
    width: ${px(52, target)};
    height: ${px(52, target)};
    border-radius: ${px(14, target)};
    background: linear-gradient(145deg, #2f80ed, #6eb6ff);
    box-shadow: 0 ${px(18, target)} ${px(45, target)} rgba(47,128,237,.28);
    position: relative;
  }
  .mark::after {
    content: "";
    position: absolute;
    width: 42%;
    height: 42%;
    left: 29%;
    top: 29%;
    border-radius: 50%;
    background: #fff;
  }
  .copy {
    margin-top: ${copyTop}px;
    text-align: center;
    padding: 0 40px;
  }
  h1 {
    font-size: ${headlineSize}px;
    line-height: 1.13;
    font-weight: 900;
    letter-spacing: 0;
    color: #126dff;
    word-break: keep-all;
  }
  p {
    margin-top: 14px;
    font-size: ${subcopySize}px;
    line-height: 1.35;
    font-weight: 700;
    color: rgba(20,32,51,.72);
    word-break: keep-all;
  }
  .device {
    margin-top: ${deviceTop}px;
    width: ${Math.round(deviceWidth)}px;
    aspect-ratio: ${aspect};
    background: #101014;
    border-radius: ${Math.round(radius)}px;
    padding: ${Math.round(padding)}px;
    box-shadow: 0 ${isPlay ? 45 : 90}px ${isPlay ? 95 : 180}px rgba(20, 74, 142, .38), inset 0 0 0 ${isPlay ? 3 : 5}px #3b3d45;
    position: relative;
    transform: rotate(${rotation});
  }
  .screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    border-radius: ${Math.max(20, Math.round(radius - padding))}px;
    display: block;
  }
  .island {
    position: absolute;
    top: ${Math.round(deviceWidth * 0.052)}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${Math.round(deviceWidth * 0.268)}px;
    height: ${Math.round(deviceWidth * 0.077)}px;
    border-radius: 999px;
    background: #050507;
  }
  .hole {
    position: absolute;
    top: ${Math.round(deviceWidth * 0.038)}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${Math.round(deviceWidth * 0.031)}px;
    height: ${Math.round(deviceWidth * 0.031)}px;
    border-radius: 50%;
    background: #050507;
  }
</style>
</head>
<body>
  <div class="brand"><span class="mark"></span><span>누가낼래</span></div>
  <section class="copy">
    <h1>${headline}</h1>
    <p>${subcopy}</p>
  </section>
  <div class="device">
    <img class="screen" src="${screenshotUrl}" alt="">
    ${isPlay ? '<div class="hole"></div>' : '<div class="island"></div>'}
  </div>
</body>
</html>`
}

await rm(outputRoot, { recursive: true, force: true })
await rm(htmlDir, { recursive: true, force: true })
await mkdir(htmlDir, { recursive: true })

for (const target of targets) {
  const outDir = path.join(outputRoot, target.id)
  await mkdir(outDir, { recursive: true })

  for (let i = 0; i < slides.length; i += 1) {
    const index = i + 1
    const base = String(index).padStart(2, '0')
    const htmlPath = path.join(htmlDir, `${target.id}-${base}.html`)
    const outPath = path.join(outDir, `${base}.png`)
    await writeFile(htmlPath, htmlFor(slides[i], i, target), 'utf8')

    const result = spawnSync(chrome, [
      '--headless=new',
      `--screenshot=${outPath}`,
      `--window-size=${target.width},${target.height}`,
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--virtual-time-budget=2000',
      pathToFileURL(htmlPath).href,
    ], { stdio: 'inherit' })

    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }
}

console.log(outputRoot)
