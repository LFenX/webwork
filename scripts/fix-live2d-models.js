// Phase D one-shot: normalize model3.json files under public/live2d/models/
// - Strip UTF-8 BOM if present
// - Patch HitArea Name fields where the conventional Id maps to a known Name
// - Rename empty-string motion group ("") to "Idle" (if model has none) or "TapBody"
// Idempotent: rerunning is a no-op once everything is normalized.
//
// Intentionally a plain JS file (not TS) so it can be invoked with `node` directly
// without depending on the project's tsconfig or build pipeline.

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..", "public", "live2d", "models")

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.name.endsWith(".model3.json") ? [p] : []
  })
}

const report = []

for (const file of walk(ROOT)) {
  let raw = fs.readFileSync(file, "utf8")
  let changed = false
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1)
    changed = true
  }
  const json = JSON.parse(raw)
  const rel = path.relative(ROOT, file).replace(/\\/g, "/")

  // 1. HitArea name normalization (Cubism convention).
  for (const area of json.HitAreas || []) {
    if (!area.Name || area.Name === "") {
      if (area.Id === "HitAreaHead") {
        area.Name = "Head"
        changed = true
      } else if (area.Id === "HitAreaBody") {
        area.Name = "Body"
        changed = true
      }
    }
  }

  // 2. Empty-string motion group rename.
  const motions = (json.FileReferences && json.FileReferences.Motions) || null
  if (motions && Object.prototype.hasOwnProperty.call(motions, "")) {
    const hasIdle = Object.prototype.hasOwnProperty.call(motions, "Idle")
    const target = hasIdle ? "TapBody" : "Idle"
    // Merge with existing target group if any.
    motions[target] = (motions[target] || []).concat(motions[""])
    delete motions[""]
    changed = true
    report.push(`${rel} :: renamed "" motion group → "${target}"`)
  }

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(json, null, "\t"), { encoding: "utf8" })
    report.push(`PATCHED ${rel}`)
  } else {
    report.push(`ok      ${rel}`)
  }
}

for (const line of report) console.log(line)
