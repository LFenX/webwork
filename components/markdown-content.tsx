import { MDXRemote } from "next-mdx-remote/rsc"

interface MarkdownContentProps {
  source: string
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <div className="prose">
      <MDXRemote source={source} />
    </div>
  )
}
