import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

interface MarkdownContentProps {
  source: string
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {source}
      </Markdown>
    </div>
  )
}
