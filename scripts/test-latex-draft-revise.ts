import assert from "node:assert/strict"
import { createDraft, upsertSection, revisePlan, draftStatus, assembleDraftBody } from "@/lib/latex/draft"

// Pure unit test for incremental long-document draft revision: re-planning must
// reuse already-written chapters instead of wiping them (the fix for "model adds
// a few chapters then rewrites everything from zero").
//
// Run: npx tsx --tsconfig scripts/tsconfig.preview.json scripts/test-latex-draft-revise.ts

const TAG = "[test-latex-draft-revise]"
const tests: Array<{ name: string; fn: () => void }> = []
function test(name: string, fn: () => void) {
  tests.push({ name, fn })
}

// A draft with the first two of three chapters written.
function seeded() {
  let d = createDraft(["引言", "方法", "结论"], "测试文档")
  d = upsertSection(d, "引言", "这是引言的完整内容。")
  d = upsertSection(d, "方法", "这是方法章节的完整内容。")
  return d
}

test("新增章节: 保留已写章节, 仅新增章待写", () => {
  const before = seeded()
  // Doc too short → model expands the outline with extra chapters.
  const { draft, reused, added, removed } = revisePlan(before, [
    "引言", "方法", "实验", "讨论", "结论",
  ])
  assert.deepEqual(reused.sort(), ["引言", "方法"].sort(), "written chapters reused")
  assert.deepEqual(added.sort(), ["实验", "讨论"].sort(), "only genuinely new chapters added")
  assert.deepEqual(removed, [], "nothing removed")
  // Previously written content survives untouched.
  assert.equal(draft.sections["引言"].bodyLatex, "这是引言的完整内容。")
  assert.equal(draft.sections["方法"].bodyLatex, "这是方法章节的完整内容。")
  const st = draftStatus(draft)
  assert.equal(st.totalCount, 5)
  assert.equal(st.filledCount, 2, "still only the 2 originals are written")
  assert.deepEqual(st.missing.sort(), ["实验", "讨论", "结论"].sort())
  // Assembled body keeps the original prose under the right headings.
  const body = assembleDraftBody(draft)
  assert.ok(body.includes("这是引言的完整内容。"))
  assert.ok(body.includes("\\section{实验}"), "new chapter heading present (empty body)")
})

test("重排顺序: 正文跟随, 全部保留", () => {
  const before = seeded()
  const { draft, reused, removed } = revisePlan(before, ["方法", "引言", "结论"])
  assert.deepEqual(reused.sort(), ["引言", "方法"].sort())
  assert.deepEqual(removed, [])
  assert.deepEqual(draft.plan, ["方法", "引言", "结论"], "plan reordered")
  const body = assembleDraftBody(draft)
  // 方法 now precedes 引言 in the assembled output.
  assert.ok(body.indexOf("方法章节的完整内容") < body.indexOf("引言的完整内容"))
})

test("重命名章节: 正文跟随 rename 映射", () => {
  const before = seeded()
  const { draft, reused, added, removed } = revisePlan(
    before,
    ["绪论", "方法", "结论"],
    { rename: { 引言: "绪论" } },
  )
  assert.ok(reused.includes("绪论"), "renamed chapter counts as reused")
  assert.ok(!added.includes("绪论"), "renamed chapter is NOT treated as new")
  assert.deepEqual(removed, [], "rename does not drop content")
  assert.equal(draft.sections["绪论"].bodyLatex, "这是引言的完整内容。", "content followed the rename")
})

test("删除章节: 仅报告被丢弃的已写章节", () => {
  const before = seeded()
  const { draft, removed } = revisePlan(before, ["引言", "结论"])
  assert.deepEqual(removed, ["方法"], "dropped written chapter reported as removed")
  assert.equal(draft.sections["方法"], undefined, "dropped chapter content gone")
  assert.equal(draft.sections["引言"].bodyLatex, "这是引言的完整内容。", "kept chapter intact")
})

let passed = 0
let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`${TAG} ✓ ${t.name}`)
    passed += 1
  } catch (error) {
    failed += 1
    console.error(`${TAG} ✗ ${t.name}`)
    console.error(error instanceof Error ? error.stack ?? error.message : error)
  }
}
console.log(`${TAG} ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
