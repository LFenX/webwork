export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 animate-pulse sm:mb-9">
        <div className="h-7 w-24 rounded-full bg-[--color-bg-hover]" />
        <div className="mt-4 h-3 w-36 rounded-full bg-[--color-bg-hover]" />
        <div className="mt-3 h-8 w-56 max-w-full rounded-full bg-[--color-bg-hover]" />
        <div className="mt-3 h-4 w-[min(28rem,100%)] rounded-full bg-[--color-bg-hover]" />
      </div>

      <section className="animate-pulse overflow-hidden rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-surface] shadow-[--shadow-profile-card]">
        <header className="flex items-start gap-3 border-b border-[--color-border] px-5 py-4 sm:px-6 sm:py-5">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[--color-brand-soft]" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-32 rounded-full bg-[--color-bg-hover]" />
            <div className="mt-2 h-3 w-64 max-w-full rounded-full bg-[--color-bg-hover]" />
          </div>
        </header>
        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="max-w-md flex-1 space-y-2">
                <div className="h-4 w-28 rounded-full bg-[--color-bg-hover]" />
                <div className="h-3 w-64 max-w-full rounded-full bg-[--color-bg-hover]" />
              </div>
              <div className="h-10 w-full rounded-[--radius-md] bg-[--color-bg-hover] sm:w-72" />
            </div>
          ))}
        </div>
        <footer className="flex justify-end border-t border-[--color-border] bg-[--color-bg-soft] px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="h-9 w-24 rounded-[--radius-md] bg-[--color-brand-soft]" />
        </footer>
      </section>
    </div>
  )
}
