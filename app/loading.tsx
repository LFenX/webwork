export default function RootLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f9fc] px-3 py-3 text-slate-950 sm:px-5 sm:py-4 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1500px] animate-pulse space-y-3 lg:space-y-4">
        <div className="rounded-[10px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-16 rounded-full bg-slate-100 sm:size-20" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-36 rounded-full bg-slate-100" />
                <div className="h-3 w-48 max-w-full rounded-full bg-slate-100" />
                <div className="h-7 w-64 max-w-full rounded-[8px] bg-slate-100" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 md:w-[168px] md:grid-cols-1">
              <div className="h-8 rounded-[8px] bg-blue-100" />
              <div className="h-8 rounded-[8px] bg-slate-100" />
              <div className="h-8 rounded-[8px] bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="grid gap-1.5 rounded-[10px] border border-slate-200/80 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.035)] min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="min-w-0 rounded-[8px] border border-slate-100 px-3 py-2.5 xl:border-0 xl:border-r xl:last:border-r-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-[8px] bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-14 rounded-full bg-slate-100" />
                  <div className="h-5 w-12 rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-3 lg:space-y-4">
            <div className="overflow-hidden rounded-[10px] border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)]">
              <div className="flex min-h-[50px] items-center justify-between border-b border-slate-100 px-3.5 sm:px-4">
                <div className="h-5 w-28 rounded-full bg-slate-100" />
                <div className="h-8 w-20 rounded-[7px] bg-slate-100" />
              </div>
              <div className="space-y-3 p-3.5 sm:p-4">
                <div className="h-4 w-3/4 rounded-full bg-slate-100" />
                <div className="h-4 w-5/6 rounded-full bg-slate-100" />
                <div className="h-4 w-2/3 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="h-36 rounded-[10px] border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)]" />
          </div>
          <div className="hidden space-y-3 lg:space-y-4 xl:block">
            <div className="h-40 rounded-[10px] border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)]" />
            <div className="h-40 rounded-[10px] border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
