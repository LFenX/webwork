import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert"
import { slugHeading } from "@/lib/toc"
import { MermaidBlock } from "@/components/mermaid-block"
import { CodeBlockReader } from "@/components/code-block-reader"
import { codeFingerprint, detectLanguage } from "@/lib/code-block"
import type { Components } from "react-markdown"
import type { ReactNode } from "react"

interface MarkdownContentProps {
  source: string
  /** When provided, code-block theme picks are scoped + persisted under this id. */
  postId?: string
}

function buildComponents(postId?: string): Components {
  return {
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
    pre: ({ children }) => {
      // react-markdown passes <pre><code class="language-x">...</code></pre>.
      // Extract the language and the inner code element so we can render a styled wrapper.
      const childArr = Array.isArray(children) ? children : [children]
      const codeEl = childArr.find((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return c && typeof c === "object" && (c as any).type === "code"
      }) as { props?: { className?: string; children?: ReactNode } } | undefined

      const className = codeEl?.props?.className
      const language = detectLanguage(className)
      const innerChildren = codeEl?.props?.children ?? children

      // Mermaid renders to a diagram, not a code block.
      if (language === "mermaid") {
        const text = typeof innerChildren === "string"
          ? innerChildren
          : Array.isArray(innerChildren)
          ? innerChildren.join("")
          : String(innerChildren)
        return <MermaidBlock code={text.replace(/\n$/, "")} />
      }

      const fp = codeFingerprint(innerChildren)
      const storageKey = postId ? `post-code-theme:${postId}:${fp}` : undefined
      return (
        <CodeBlockReader language={language} storageKey={storageKey}>
          <code className={className}>{innerChildren}</code>
        </CodeBlockReader>
      )
    },
    code: ({ className, children, ...props }) => {
      // Inline code only — block code is now intercepted by the `pre` renderer above.
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }
}

export function MarkdownContent({ source, postId }: MarkdownContentProps) {
  return (
    <div className="prose">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkGithubBlockquoteAlert]}
        rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: "ignore", throwOnError: false }], rehypeHighlight]}
        components={buildComponents(postId)}
      >
        {source}
      </Markdown>
    </div>
  )
}
