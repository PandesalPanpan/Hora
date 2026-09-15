import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outputRoot = path.resolve(process.argv[2] ?? '.artifacts/mobile-repair/current')
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5173'
const seeded = process.argv.includes('--seeded')
const routes = ['today', 'planner', 'tasks', 'reports', 'settings']
const viewports = [[320, 568], [360, 800], [390, 844], [1024, 768]]

await mkdir(outputRoot, { recursive: true })

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

const websocketUrl = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Chrome DevTools endpoint timed out')), 10_000)
  chrome.stderr.setEncoding('utf8')
  chrome.stderr.on('data', (chunk) => {
    const match = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match) {
      clearTimeout(timeout)
      resolve(match[1])
    }
  })
  chrome.once('exit', (code) => reject(new Error(`Chrome exited before capture (${code})`)))
})

const browserSocket = new WebSocket(websocketUrl)
await new Promise((resolve, reject) => {
  browserSocket.addEventListener('open', resolve, { once: true })
  browserSocket.addEventListener('error', reject, { once: true })
})

let nextId = 0
const pending = new Map()
browserSocket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (!message.id) return
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
})

function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    browserSocket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}

const { targetId } = await command('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true })
await command('Page.enable', {}, sessionId)
await command('Runtime.enable', {}, sessionId)

const report = []
async function capture(route, name, width, height) {
  const metrics = await command('Runtime.evaluate', {
    expression: `JSON.stringify({
      innerWidth,
      innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      overflowing: [...document.querySelectorAll('*')]
        .filter((element) => !element.classList.contains('sr-only') && element.scrollWidth > element.clientWidth + 1)
        .slice(0, 12)
        .map((element) => ({ tag: element.tagName, className: element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    })`,
    returnByValue: true,
  }, sessionId)
  const screenshot = await command('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId)
  await writeFile(path.join(outputRoot, `${name}-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'))
  report.push({ route, scenario: name, width, height, ...JSON.parse(metrics.result.value) })
}

try {
  for (const [width, height] of viewports) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 760,
      screenWidth: width,
      screenHeight: height,
    }, sessionId)

    for (const route of routes) {
      await command('Page.navigate', { url: `${baseUrl}/#/${route}` }, sessionId)
      await new Promise((resolve) => setTimeout(resolve, 450))
      if (seeded) {
        await command('Runtime.evaluate', {
          expression: `(() => {
            const end = new Date();
            const start = new Date(end.getTime() - 42 * 60 * 1000);
            localStorage.setItem('iza.completed-sessions.v1', JSON.stringify([{ id: 'visual-study', activity: { id: 'study', name: 'Study', color: '#d92f6f' }, startedAt: start.toISOString(), finishedAt: end.toISOString(), targetMinutes: 25, status: 'completed', pausedAt: null, pausedSeconds: 0 }]));
            localStorage.setItem('iza.tasks.v1', JSON.stringify([{ id: 'visual-task', title: 'Review biology notes', estimateMinutes: 25, completed: false }]));
            if (!sessionStorage.getItem('iza-visual-seeded')) { sessionStorage.setItem('iza-visual-seeded', '1'); location.reload(); }
          })()`,
        }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 450))
      }
      await capture(route, route, width, height)
      if (route === 'today') {
        await command('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Pomodoro')?.click()` }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 200))
        await capture(route, 'pomodoro-setup', width, height)
      }
      if (route === 'today' && seeded) {
        await command('Runtime.evaluate', { expression: `window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })` }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 150))
        await capture(route, 'today-sessions', width, height)
      }
      if (route === 'planner') {
        await command('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Week')?.click()` }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 200))
        await capture(route, 'planner-week', width, height)
      }
    }
  }
  await writeFile(path.join(outputRoot, 'overflow-report.json'), JSON.stringify(report, null, 2))
} finally {
  browserSocket.close()
  chrome.kill()
}

console.log(JSON.stringify(report, null, 2))
