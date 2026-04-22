import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert"
import { slugHeading } from "@/components/article-sidebar"
import { MermaidBlock } from "@/components/mermaid-block"
import type { Components } from "react-markdown"

interface MarkdownContentProps {
  source: string
}

const components: Components = {
  h1: ({ children }) => <h1 id={slugHeading(String(children))}>{children}</h1>,
  h2: ({ children }) => <h2 id={slugHeading(String(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={slugHeading(String(children))}>{children}</h3>,
  img: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      className="max-w-full h-auto rounded"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "")
    const lang = match?.[1] ?? ""
    const code = String(children).replace(/\n$/, "")

    if (lang === "mermaid") {
      return <MermaidBlock code={code} />
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <div className="prose">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkGithubBlockquoteAlert]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  )
}
