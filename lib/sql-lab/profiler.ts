import "server-only"

import crypto from "node:crypto"
import { prisma } from "@/lib/db"

type ProfileMode = "light" | "full"

type ColumnProfileTarget = {
  schemaName: string
  tableName: string
  columnName: string
  dataType: string
}

type TableEstimateRow = {
  schemaName: string
  tableName: string
  rowEstimate: number | bigint | null
}

type ColumnRow = ColumnProfileTarget

function newId() {
  return `profile_${crypto.randomUUID().replace(/-/g, "")}`
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function readTargets(schemas: string[]) {
  return prisma.$queryRaw<ColumnRow[]>`
    SELECT
      table_schema AS "schemaName",
      table_name AS "tableName",
      column_name AS "columnName",
      data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = ANY(${schemas})
      AND table_name NOT LIKE '_prisma_%'
    ORDER BY table_schema, table_name, ordinal_position
  `
}

async function readTableEstimates(schemas: string[]) {
  const rows = await prisma.$queryRaw<TableEstimateRow[]>`
    SELECT
      n.nspname AS "schemaName",
      c.relname AS "tableName",
      GREATEST(c.reltuples::bigint, 0) AS "rowEstimate"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname = ANY(${schemas})
  `
  return new Map(rows.map((row) => [`${row.schemaName}.${row.tableName}`, Number(row.rowEstimate ?? 0)]))
}

async function profileColumn(target: ColumnProfileTarget, mode: ProfileMode) {
  const isNumeric = /(int|numeric|decimal|double|real|money)/i.test(target.dataType)
  const isTime = /(timestamp|date|time)/i.test(target.dataType)
  const sqlName = `${quoteIdent(target.schemaName)}.${quoteIdent(target.tableName)}`
  const col = quoteIdent(target.columnName)

  if (mode === "light") {
    return {
      dataType: target.dataType,
      isLikelyEnum: /char|text|boolean|USER-DEFINED/i.test(target.dataType),
      sampleValues: [],
    }
  }

  const [sampleRows, distinctRows, nullRows, minMaxRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
      `SELECT ${col} AS value FROM ${sqlName} WHERE ${col} IS NOT NULL LIMIT 8`,
    ).catch(() => []),
    prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(DISTINCT ${col}) AS count FROM ${sqlName}`,
    ).catch(() => []),
    prisma.$queryRawUnsafe<Array<{ ratio: number }>>(
      `SELECT COALESCE(AVG(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END), 0)::float AS ratio FROM ${sqlName}`,
    ).catch(() => []),
    isNumeric || isTime
      ? prisma.$queryRawUnsafe<Array<{ minValue: unknown; maxValue: unknown }>>(
          `SELECT MIN(${col}) AS "minValue", MAX(${col}) AS "maxValue" FROM ${sqlName}`,
        ).catch(() => [])
      : Promise.resolve([]),
  ])

  const distinctCount = Number(distinctRows[0]?.count ?? 0)
  return {
    dataType: target.dataType,
    distinctCount,
    nullRatio: Number(nullRows[0]?.ratio ?? 0),
    sampleValues: sampleRows.map((row) => row.value).filter((value) => value !== null),
    minValue: minMaxRows[0]?.minValue ?? null,
    maxValue: minMaxRows[0]?.maxValue ?? null,
    isLikelyEnum: distinctCount > 0 && distinctCount <= 20 && !isNumeric && !isTime,
  }
}

async function upsertProfile(input: {
  schemaName: string
  tableName: string
  columnName?: string | null
  profileJson: unknown
  expiresAt: Date
}) {
  await prisma.$executeRaw`
    INSERT INTO "SqlSchemaProfile" (id, "schemaName", "tableName", "columnName", "profileJson", "generatedAt", "expiresAt")
    VALUES (${newId()}, ${input.schemaName}, ${input.tableName}, ${input.columnName ?? null}, ${input.profileJson}, now(), ${input.expiresAt})
    ON CONFLICT ("schemaName", "tableName", "columnName") DO UPDATE SET
      "profileJson" = EXCLUDED."profileJson",
      "generatedAt" = now(),
      "expiresAt" = EXCLUDED."expiresAt"
  `
}

export async function refreshSchemaProfiles(options: { schemas?: string[]; mode?: ProfileMode } = {}) {
  const schemas = options.schemas?.length ? options.schemas : ["public"]
  const mode = options.mode ?? "light"
  const expiresAt = addDays(new Date(), 7)
  const [targets, estimates] = await Promise.all([readTargets(schemas), readTableEstimates(schemas)])
  const tableKeys = new Set(targets.map((target) => `${target.schemaName}.${target.tableName}`))

  let tableCount = 0
  let columnCount = 0
  for (const key of tableKeys) {
    const [schemaName, tableName] = key.split(".")
    await upsertProfile({
      schemaName,
      tableName,
      columnName: null,
      expiresAt,
      profileJson: {
        rowEstimate: estimates.get(key) ?? 0,
        mode,
      },
    })
    tableCount += 1
  }

  for (const target of targets) {
    const profile = await profileColumn(target, mode)
    await upsertProfile({
      schemaName: target.schemaName,
      tableName: target.tableName,
      columnName: target.columnName,
      expiresAt,
      profileJson: {
        rowEstimate: estimates.get(`${target.schemaName}.${target.tableName}`) ?? 0,
        ...profile,
      },
    })
    columnCount += 1
  }

  return { mode, schemas, tableCount, columnCount, generatedAt: new Date().toISOString() }
}
