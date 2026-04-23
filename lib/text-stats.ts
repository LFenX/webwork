export function countWords(content: string) {
  const text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`~\-[\](){}|]/g, " ")
    .trim()

  const cjk = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0
  const words = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0
  return cjk + words
}

export function readingMinutes(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 400))
}
