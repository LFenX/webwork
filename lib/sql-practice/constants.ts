export const SQL_PRACTICE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const
export type SqlPracticeDifficulty = (typeof SQL_PRACTICE_DIFFICULTIES)[number]

export const SQL_PRACTICE_DIFFICULTY_LABELS: Record<SqlPracticeDifficulty, string> = {
  Easy: "简单",
  Medium: "中等",
  Hard: "困难",
}

export const SQL_PRACTICE_DIFFICULTY_COLORS: Record<SqlPracticeDifficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Hard: "bg-rose-50 text-rose-700 border-rose-200",
}

export const SQL_PRACTICE_SOURCES = [
  "LeetCode",
  "牛客",
  "HackerRank",
  "SQLZoo",
  "DataLemur",
  "StrataScratch",
  "面试题",
  "自建",
  "其他",
] as const
export type SqlPracticeSource = (typeof SQL_PRACTICE_SOURCES)[number]

// 题型常用 tag 池，用户也可以自由输入新 tag
export const SQL_PRACTICE_TAG_PRESETS = [
  "窗口函数",
  "聚合",
  "分组",
  "JOIN",
  "子查询",
  "CTE",
  "递归 CTE",
  "条件聚合",
  "去重",
  "排名",
  "TopN",
  "时间序列",
  "日期函数",
  "字符串处理",
  "行列转换",
  "PIVOT",
  "UNION",
  "EXISTS",
  "NULL 处理",
  "事务",
  "索引",
] as const

// 解题方法 / 关键 SQL 用法
export const SQL_PRACTICE_METHOD_PRESETS = [
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "LAG/LEAD",
  "SUM OVER",
  "INNER JOIN",
  "LEFT JOIN",
  "SELF JOIN",
  "EXISTS",
  "GROUP BY",
  "HAVING",
  "CASE WHEN",
  "WITH CTE",
  "递归 CTE",
  "子查询",
  "DISTINCT ON",
  "UNION ALL",
  "PIVOT",
  "COALESCE",
] as const
