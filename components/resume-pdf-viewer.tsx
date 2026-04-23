export function ResumePdfViewer({ src, title = "简历 PDF" }: { src: string; title?: string }) {
  return (
    <div className="mx-auto w-full max-w-[820px] overflow-x-hidden">
      <iframe
        src={src}
        className="h-[1200px] min-h-[calc(var(--app-viewport-height)-12rem)] w-full border-0 bg-white"
        title={title}
      />
    </div>
  )
}
