// End-to-end check against the production build (run `npm run build` first).
// Drives the real Electron app with a throwaway data folder, covering routine
// creation, scheduling, logging, restart recovery, finishing, history
// correction, records, unit conversion, backup export/restore and reset.
// Screenshots land in e2e-shots/.
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const root = process.cwd()
const dataDir = join(root, '.e2e-data')
const shotsDir = join(root, 'e2e-shots')
const backupPath = join(dataDir, 'backup-test.json')

rmSync(dataDir, { recursive: true, force: true })
rmSync(shotsDir, { recursive: true, force: true })
mkdirSync(dataDir, { recursive: true })
mkdirSync(shotsDir, { recursive: true })

const pad = (n) => String(n).padStart(2, '0')
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = new Date()
const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)

let app
let page
let step = 0

function log(msg) {
  console.log(`✓ ${msg}`)
}

function check(condition, message) {
  if (!condition) throw new Error(`Check failed: ${message}`)
  log(message)
}

async function launch() {
  // Some hosts (e.g. VS Code terminals) set this, which turns Electron into plain Node.
  const env = { ...process.env, PGJ_USER_DATA_DIR: dataDir, ELECTRON_RENDERER_URL: '' }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: root,
    env
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE:', msg.text())
  })
  await page.waitForSelector('nav[aria-label="Main"]')
  await setSize(1280, 820)
}

async function setSize(width, height) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [width, height])
  await page.waitForTimeout(300)
}

async function shot(name) {
  step++
  await page.waitForTimeout(350)
  await page.screenshot({ path: join(shotsDir, `${pad(step)}-${name}.png`) })
}

async function nav(label) {
  await page.locator('nav[aria-label="Main"]').getByRole('link', { name: label }).click()
  await page.waitForTimeout(250)
}

async function logSet(weight, reps) {
  if (weight !== null) await page.keyboard.type(String(weight))
  await page.keyboard.press('Enter')
  if (reps !== null) await page.keyboard.type(String(reps))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}

try {
  await launch()
  check((await page.evaluate(() => location.href)).startsWith('app://bundle/'), 'production build is served from app://bundle')
  check(await page.evaluate(() => typeof window.require === 'undefined' && typeof window.process === 'undefined'), 'renderer has no Node.js access')
  await shot('today-empty')

  // ---- Exercises -----------------------------------------------------------
  await nav('Exercises')
  await shot('exercises-empty')
  await page.getByRole('button', { name: 'Add starter library' }).first().click()
  await page.getByText('Barbell Bench Press', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'New exercise' }).click()
  await page.fill('#ex-name', 'Ring Row')
  await page.selectOption('#ex-muscle', 'Back')
  await page.selectOption('#ex-equipment', 'Bodyweight')
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByText('Ring Row', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'New exercise' }).click()
  await page.fill('#ex-name', 'ring row')
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByText('You already have an exercise called').waitFor()
  log('duplicate exercise names are rejected')
  await page.keyboard.press('Escape')
  await page.fill('input[aria-label="Search exercises"]', 'curl')
  check((await page.locator('main li').count()) === 3, 'exercise search filters the list (3 curls)')
  await shot('exercises-search')
  await page.fill('input[aria-label="Search exercises"]', '')
  await shot('exercises-library')

  // ---- Routine -------------------------------------------------------------
  await nav('Routines')
  await shot('routines-empty')
  await page.getByRole('link', { name: 'Build your first routine' }).click()
  await page.fill('#routine-name', 'Push A')
  await page.getByRole('button', { name: 'Add exercises' }).click()
  const picker = page.getByRole('dialog')
  await picker.locator('input[aria-label="Search exercises"]').fill('Barbell Bench')
  await picker.getByRole('option', { name: /Barbell Bench Press/ }).click()
  await picker.locator('input[aria-label="Search exercises"]').fill('Pull-up')
  await picker.getByRole('option', { name: /Pull-up/ }).click()
  await picker.getByRole('button', { name: /Add to routine/ }).click()
  await page.fill('#w-k0', '60')
  await page.fill('[aria-label="Maximum reps"] >> nth=0', '4')
  await page.getByRole('button', { name: 'Save routine' }).click()
  await page.getByText('Almost there').waitFor()
  log('routine validation catches max reps below min')
  await page.fill('[aria-label="Maximum reps"] >> nth=0', '10')
  await page.getByRole('button', { name: 'Move Pull-up up' }).click()
  await page.getByRole('button', { name: 'Move Pull-up down' }).click()
  await shot('routine-editor')
  await page.getByRole('button', { name: 'Save routine' }).click()
  await page.getByText('Routine created').waitFor()
  log('routine created')
  await nav('Routines')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await page.waitForURL(/routines\/.+/)
  await nav('Routines')
  check((await page.getByText('Push A (copy)').count()) === 1, 'routine duplicated')
  await page.getByRole('button', { name: 'Delete Push A (copy)' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete routine' }).click()
  await page.getByText('Deleted Push A (copy)').waitFor()
  await shot('routines')

  // ---- Schedule ------------------------------------------------------------
  await nav('Schedule')
  await page.selectOption(`#wd-${today.getDay()}`, { label: 'Push A' })
  await page.selectOption(`#wd-${(today.getDay() + 1) % 7}`, { label: 'Rest day' })
  await page.waitForTimeout(300)
  // One-off change for next week's same weekday.
  const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
  if (nextWeek.getMonth() !== today.getMonth()) await page.getByRole('button', { name: 'Next month' }).click()
  await page.locator(`[role="gridcell"][aria-label^="${nextWeek.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}"]`).click()
  await page.selectOption('#override', 'rest')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await page.getByText('Changed the plan for').waitFor()
  log('date-specific override saved without touching the weekly plan')
  await page.getByRole('button', { name: 'Today' }).click()
  await shot('schedule')

  // ---- Workout 1: log, close app mid-workout, recover ------------------------
  await nav('Today')
  await shot('today-planned')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').waitFor()
  await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').focus()
  await logSet(60, 8)
  await logSet(60, 8)
  // Third set: keep the suggested weight (target) but forget reps -> error.
  await logSet(null, null)
  await page.getByText('Enter at least 1 rep').waitFor()
  log('completing a set without reps shows an error')
  await page.keyboard.type('6')
  await page.keyboard.press('Enter')
  await page.locator('input[aria-label="Pull-up set 1 reps"]').fill('9')
  await page.locator('input[aria-label="Pull-up set 1 reps"]').press('Enter')
  await page.fill('#session-notes', 'Felt strong today.')
  await page.waitForTimeout(900)
  await shot('workout-active')

  await app.close()
  log('closed the app mid-workout')
  await launch()
  await page.getByRole('button', { name: 'Resume workout' }).waitFor()
  log('unfinished workout is offered for resume after restart')
  await shot('today-resume')
  await page.getByRole('button', { name: 'Resume workout' }).click()
  await page.locator('input[aria-label="Barbell Bench Press set 3 reps"]').waitFor()
  check((await page.locator('input[aria-label="Barbell Bench Press set 3 reps"]').inputValue()) === '6', 'logged sets survived the restart')
  check((await page.locator('#session-notes').inputValue()) === 'Felt strong today.', 'session notes survived the restart')
  check((await page.locator('[aria-label="Complete Pull-up set 2"]').count()) === 1, 'unfinished pull-up set is still pending')

  // Rest timer controls.
  await page.getByRole('timer').getByRole('button', { name: 'Start' }).click().catch(() => undefined)
  await page.getByRole('timer').getByRole('button', { name: /Pause|Start/ }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('timer').getByRole('button', { name: /Resume|Pause|Start/ }).first().click()
  await page.getByRole('timer').getByRole('button', { name: 'Reset timer' }).click()
  log('rest timer start / pause / resume / reset')

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.getByRole('alertdialog').getByText('2 unfinished sets').waitFor()
  await shot('finish-confirm')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish workout' }).click()
  await page.getByText('Workout complete!').waitFor()
  await shot('workout-complete')
  await page.getByRole('button', { name: 'View details' }).click()

  // ---- History correction: move it to last week and fix a typo -----------------
  await page.getByRole('button', { name: 'Correct details' }).click()
  await page.fill('#session-date', key(weekAgo))
  await page.locator('input[aria-label="Set 3 reps"]').first().fill('7')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Workout updated').waitFor()
  check((await page.getByText(weekAgo.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })).count()) >= 1, 'history correction moved the date')
  await shot('session-detail')

  // ---- Workout 2: beat last week ---------------------------------------------
  await nav('Today')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').waitFor()
  check((await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').getAttribute('placeholder')) === '60', 'previous / target weight is suggested')
  check((await page.getByText('60 × 8').count()) >= 1, "previous session's values are shown")
  await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').focus()
  await logSet(62.5, 8)
  await logSet(62.5, 8)
  await logSet(62.5, 7)
  await page.locator('input[aria-label="Pull-up set 1 reps"]').fill('11')
  await page.locator('input[aria-label="Pull-up set 1 reps"]').press('Enter')
  await page.locator('input[aria-label="Pull-up set 2 reps"]').fill('8')
  await page.locator('input[aria-label="Pull-up set 2 reps"]').press('Enter')
  await page.keyboard.press('Control+Enter')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish workout' }).click()
  await page.getByText('Workout complete!').waitFor()
  await page.getByText(/new records?!/).waitFor()
  log('new personal records are celebrated')
  await shot('workout-complete-records')
  await page.getByRole('button', { name: 'Back to Today' }).click()
  await shot('today-done')

  // ---- Progress ----------------------------------------------------------------
  await nav('Progress')
  await page.selectOption('#progress-exercise', { label: 'Barbell Bench Press (2)' })
  await page.waitForTimeout(500)
  await shot('progress-exercise')
  await page.getByRole('tab', { name: 'Records' }).click()
  check((await page.getByText('62.5 kg').count()) >= 1, 'heaviest weight record is 62.5 kg')
  await shot('progress-records')
  await page.getByRole('tab', { name: 'Bodyweight' }).click()
  await page.fill('#bw-date', key(weekAgo))
  await page.fill('#bw-value', '81.4')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.fill('#bw-date', key(today))
  await page.fill('#bw-value', '80.9')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Change in range').waitFor()
  await shot('progress-bodyweight')

  // ---- Units -------------------------------------------------------------------
  await nav('Settings')
  await page.locator('[aria-label="Weight unit"]').getByText('lb', { exact: true }).click()
  await page.waitForTimeout(400)
  await nav('Progress')
  await page.getByRole('tab', { name: 'Records' }).click()
  check((await page.getByText('137.79 lb').count()) >= 1, '62.5 kg shows as 137.79 lb')
  await nav('Settings')
  await page.locator('[aria-label="Weight unit"]').getByText('kg', { exact: true }).click()
  await page.waitForTimeout(300)
  await nav('Progress')
  await page.getByRole('tab', { name: 'Records' }).click()
  check((await page.getByText('62.5 kg').count()) >= 1, 'switching back to kg is lossless')

  // ---- Backup export / reset / restore ------------------------------------------------
  await nav('Settings')
  await shot('settings')
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, backupPath)
  await page.getByRole('button', { name: 'Export backup' }).click()
  await page.getByText('Backup saved').waitFor()
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  check(backup.app === 'pixel-gym-journal' && backup.formatVersion === 1, 'backup file is versioned JSON')
  check(backup.data.sessions.length === 2, 'backup contains both workouts')

  await page.getByRole('button', { name: 'Erase everything…' }).click()
  await page.getByRole('alertdialog').locator('input').fill('ERASE')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Erase everything' }).click()
  await page.getByText('All data erased').waitFor()
  await nav('History')
  await page.getByText('Your journal is empty').waitFor()
  log('reset erased everything')

  await nav('Settings')
  await page.getByRole('button', { name: 'Restore from backup…' }).click()
  await page.getByText('Restore this backup?').waitFor()
  await shot('restore-preview')
  await page.getByRole('button', { name: 'Replace my data' }).click()
  await page.getByText(/Backup restored|Restore failed/).first().waitFor()
  const failed = page.getByRole('alert').filter({ hasText: 'Restore failed' })
  if (await failed.count()) throw new Error(`Restore failed: ${await failed.first().innerText()}`)
  log('backup restored after preview + confirmation')
  await nav('History')
  check((await page.locator('main a[href^="#/history/"]').count()) === 2, 'restore brought back both workouts')
  await shot('history')

  // Invalid file
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, join(root, 'package.json'))
  await nav('Settings')
  await page.getByRole('button', { name: 'Restore from backup…' }).click()
  await page.getByText("That file can't be restored").waitFor()
  log('invalid backup file is rejected with a clear message')
  await shot('restore-invalid')
  await page.getByRole('button', { name: 'OK' }).click()

  // ---- Small window ---------------------------------------------------------------
  await setSize(800, 600)
  await nav('Today')
  await shot('small-today')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').waitFor()
  await shot('small-workout')
  await nav('Progress')
  await shot('small-progress')
  await nav('Schedule')
  await shot('small-schedule')

  // ---- Persistence after a normal restart ----------------------------------------------
  await app.close()
  await launch()
  await nav('History')
  check((await page.locator('main a[href^="#/history/"]').count()) === 2, 'data persists after a normal restart')
  await nav('Workout')
  check((await page.locator('input[aria-label="Barbell Bench Press set 1 weight (kg)"]').count()) === 1, 'in-progress workout persists after restart')
  check(existsSync(join(dataDir, 'IndexedDB')), 'data lives in the user-data folder, not the program folder')
  await app.close()
  console.log('\nAll end-to-end checks passed. Screenshots in e2e-shots/')
} catch (error) {
  console.error('\nE2E FAILED:', error.message)
  try {
    await page?.screenshot({ path: join(shotsDir, 'failure.png') })
  } catch {}
  await app?.close().catch(() => undefined)
  process.exit(1)
}
