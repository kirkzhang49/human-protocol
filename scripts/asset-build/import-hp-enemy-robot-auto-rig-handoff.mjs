import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const args = parseArgs(process.argv.slice(2))
const handoffPath = args.handoff ? path.resolve(String(args.handoff)) : ''
const autoRigRoot = args['auto-rig-root'] ? path.resolve(String(args['auto-rig-root'])) : ''
const shouldExportGlb = Boolean(args['export-glb'])
const candidateRoot = path.resolve(
  repoRoot,
  String(args.out ?? 'src/assets/models-cooked/enemies/auto-rig-candidates'),
)

const allowedModelKeys = new Set([
  'hp_enemy_repair_drone_horror',
  'hp_enemy_clamp_repair_horror',
  'hp_enemy_shield_technician_horror',
  'hp_enemy_custodian_foreman_horror',
  'hp_enemy_reclamation_mother_final_horror',
])

if (!handoffPath) {
  fail('Missing --handoff <auto-rig-handoff.json>')
}
if (!existsSync(handoffPath)) {
  fail(`Handoff JSON not found: ${handoffPath}`)
}
if (shouldExportGlb && (!autoRigRoot || !existsSync(path.join(autoRigRoot, 'scripts/export-robot-glb.mjs')))) {
  fail('Using --export-glb requires --auto-rig-root pointing at the auto-rig-3d repo.')
}

const handoff = JSON.parse(await readFile(handoffPath, 'utf8'))
const normalized = normalizeHandoff(handoff)
const candidateDir = path.join(candidateRoot, normalized.modelKey, normalized.handoffId)
const assetJsonPath = path.join(candidateDir, 'asset.robot-asset.json')
const importedHandoffPath = path.join(candidateDir, 'auto-rig-handoff.json')
const reportJsonPath = path.join(candidateDir, 'import-report.json')
const reportMdPath = path.join(candidateDir, 'import-report.md')

await mkdir(candidateDir, { recursive: true })
await writeFile(importedHandoffPath, `${JSON.stringify(handoff, null, 2)}\n`, 'utf8')
await writeFile(assetJsonPath, `${JSON.stringify(normalized.asset, null, 2)}\n`, 'utf8')

const report = {
  schemaVersion: 'human-protocol/auto-rig-handoff-import-report@1',
  importedAt: new Date().toISOString(),
  sourceHandoff: handoffPath,
  candidateDir: path.relative(repoRoot, candidateDir),
  modelKey: normalized.modelKey,
  hpRobot: normalized.hpRobot,
  selected: normalized.selected,
  files: {
    handoff: path.relative(repoRoot, importedHandoffPath),
    robotAssetJson: path.relative(repoRoot, assetJsonPath),
  },
  checks: {
    schema: handoff.schemaVersion === 'human-protocol/auto-rig-robot-handoff@1',
    modelKeyAllowed: allowedModelKeys.has(normalized.modelKey),
    hasSelectedAsset: Boolean(normalized.asset?.id),
    hasPromptModelKey: String(normalized.hpRobot.prompt ?? '').includes(normalized.modelKey),
    exportGlbRequested: shouldExportGlb,
    exportGlbProduced: false,
    autoRigValidationPassed: false,
  },
  export: undefined,
  nextSteps: [
    'Review this candidate package before touching official enemy GLBs.',
    'If GLB export was not requested, rerun this script with --export-glb and --auto-rig-root.',
    'Run the enemy robot audit after candidate GLB export.',
    'Only replace official GLBs after candidate QA, screenshots, and Raw WGPU rebuild proof pass.',
  ],
}

if (!report.checks.schema || !report.checks.modelKeyAllowed || !report.checks.hasSelectedAsset || !report.checks.hasPromptModelKey) {
  await writeReport(reportJsonPath, reportMdPath, report)
  fail(`Invalid Human Protocol handoff. Wrote report: ${path.relative(repoRoot, reportJsonPath)}`)
}

if (shouldExportGlb) {
  const exportRoot = path.join(candidateDir, 'auto-rig-export')
  await mkdir(exportRoot, { recursive: true })
  const run = spawnSync(
    'node',
    ['scripts/export-robot-glb.mjs', '--asset', assetJsonPath, '--out', exportRoot],
    {
      cwd: autoRigRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    },
  )
  const exportDir = existsSync(exportRoot) ? await findExportDir(exportRoot) : undefined
  const validationPath = exportDir ? path.join(exportDir, 'validation-report.json') : ''
  const validation = validationPath && existsSync(validationPath)
    ? JSON.parse(await readFile(validationPath, 'utf8'))
    : undefined
  const glbProduced = Boolean(exportDir && existsSync(path.join(exportDir, 'robot.glb')))
  const validationPassed = validation?.result === 'pass'
  report.checks.exportGlbProduced = glbProduced
  report.checks.autoRigValidationPassed = validationPassed
  report.export = {
    command: `node scripts/export-robot-glb.mjs --asset ${assetJsonPath} --out ${exportRoot}`,
    autoRigRoot,
    status: run.status,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim(),
    exportDir: exportDir ? path.relative(repoRoot, exportDir) : undefined,
    validationResult: validation?.result,
    validationNotes: validation?.notes,
    missingBakedAnimationClips: validation?.missingBakedAnimationClips,
    missingSockets: validation?.missingSockets,
    missingRequiredClips: validation?.missingRequiredClips,
  }
  if (exportDir) {
    const glbSource = path.join(exportDir, 'robot.glb')
    const validationSource = validationPath
    const manifestSource = path.join(exportDir, 'export-manifest.json')
    const combatSource = path.join(exportDir, 'combat-actions.json')
    const glbTarget = path.join(candidateDir, `${normalized.modelKey}.glb`)
    await copyFile(glbSource, glbTarget)
    if (existsSync(validationSource)) await copyFile(validationSource, path.join(candidateDir, 'auto-rig-validation-report.json'))
    if (existsSync(manifestSource)) await copyFile(manifestSource, path.join(candidateDir, 'auto-rig-export-manifest.json'))
    if (existsSync(combatSource)) await copyFile(combatSource, path.join(candidateDir, 'auto-rig-combat-actions.json'))
    report.files.candidateGlb = path.relative(repoRoot, glbTarget)
    report.files.autoRigValidation = 'auto-rig-validation-report.json'
    report.files.autoRigExportManifest = 'auto-rig-export-manifest.json'
    report.files.autoRigCombatActions = 'auto-rig-combat-actions.json'
  }
  if (!glbProduced) {
    await writeReport(reportJsonPath, reportMdPath, report)
    fail(`auto-rig GLB export produced no robot.glb. Wrote report: ${path.relative(repoRoot, reportJsonPath)}`)
  }
  if (!validationPassed) {
    report.nextSteps.unshift('Auto-rig exported a candidate GLB, but its own validation did not pass. Treat this as candidate evidence, not a replacement-ready asset.')
  }
}

await writeReport(reportJsonPath, reportMdPath, report)

console.log(`Imported HP auto-rig handoff for ${normalized.modelKey}`)
console.log(`- ${path.relative(repoRoot, importedHandoffPath)}`)
console.log(`- ${path.relative(repoRoot, assetJsonPath)}`)
if (report.files.candidateGlb) console.log(`- ${report.files.candidateGlb}`)
console.log(`- ${path.relative(repoRoot, reportJsonPath)}`)
console.log(`- ${path.relative(repoRoot, reportMdPath)}`)

function normalizeHandoff(handoffValue) {
  const hpRobot = handoffValue?.hpRobot ?? {}
  const selected = handoffValue?.selected ?? {}
  const modelKey = String(hpRobot.modelKey ?? '').trim()
  const handoffId = sanitizeToken(String(handoffValue?.handoffId ?? `${modelKey}-${Date.now()}`))
  const asset = selected.asset
  return {
    handoffId,
    modelKey,
    hpRobot: {
      id: String(hpRobot.id ?? '').trim(),
      label: String(hpRobot.label ?? '').trim(),
      modelKey,
      role: String(hpRobot.role ?? '').trim(),
      prompt: String(hpRobot.prompt ?? '').trim(),
      baselinePrompt: String(hpRobot.baselinePrompt ?? '').trim(),
    },
    selected: {
      assetId: String(selected.assetId ?? asset?.id ?? '').trim(),
      robotTypeProfileId: selected.robotTypeProfileId,
      bodyPlanPresetId: selected.bodyPlanPresetId,
      activeModelRoute: selected.activeModelRoute,
      hardGate: Boolean(selected.hardGate),
      hardFailMask: Array.isArray(selected.hardFailMask) ? selected.hardFailMask : [],
      score100: Number.isFinite(selected.score100) ? selected.score100 : undefined,
    },
    asset,
  }
}

async function findExportDir(rootDir) {
  const entries = await import('node:fs/promises').then((fs) => fs.readdir(rootDir, { withFileTypes: true }))
  const names = new Set(entries.map((entry) => entry.name))
  if (names.has('robot.glb') && names.has('validation-report.json')) return rootDir
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = await findExportDir(path.join(rootDir, entry.name))
    if (found) return found
  }
  return undefined
}

async function writeReport(jsonPath, mdPath, reportValue) {
  await writeFile(jsonPath, `${JSON.stringify(reportValue, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, `${renderMarkdownReport(reportValue)}\n`, 'utf8')
}

function renderMarkdownReport(reportValue) {
  const checks = Object.entries(reportValue.checks)
    .map(([key, value]) => `- ${key}: ${value ? 'pass' : 'fail'}`)
    .join('\n')
  const files = Object.entries(reportValue.files)
    .map(([key, value]) => `- ${key}: \`${value}\``)
    .join('\n')
  return `# HP Enemy Robot Auto-Rig Handoff Import

Model key: \`${reportValue.modelKey}\`

Candidate directory: \`${reportValue.candidateDir}\`

## Checks

${checks}

## Files

${files}

## Next Steps

${reportValue.nextSteps.map((step) => `- ${step}`).join('\n')}
`
}

function parseArgs(tokens) {
  const parsed = {}
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = tokens[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
      continue
    }
    parsed[key] = next
    index += 1
  }
  return parsed
}

function sanitizeToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
