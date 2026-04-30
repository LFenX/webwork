"use client"

import type { BasicsForm } from "@/lib/resume/form-types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function BasicsSection({
  value,
  onChange,
  title,
}: {
  value: BasicsForm
  onChange: (v: BasicsForm) => void
  title?: string
}) {
  function set(field: keyof BasicsForm, val: string) {
    onChange({ ...value, [field]: val })
  }

  const row = (label: string, field: keyof BasicsForm, props?: { type?: string; placeholder?: string }) => (
    <div>
      <Label className="text-xs text-[--color-text-secondary]">{label}</Label>
      <Input
        value={value[field]}
        onChange={(e) => set(field, e.target.value)}
        type={props?.type ?? "text"}
        placeholder={props?.placeholder}
        className="mt-1 h-9 text-sm"
      />
    </div>
  )

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <h2 className="mb-4 text-sm font-semibold">{title ?? "基本信息"}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {row("姓名", "name", { placeholder: "你的姓名" })}
        {row("目标岗位", "label", { placeholder: "如：全栈工程师" })}
        {row("邮箱", "email", { type: "email", placeholder: "you@example.com" })}
        {row("手机", "phone", { type: "tel", placeholder: "+86 138..." })}
        {row("个人网站", "url", { type: "url", placeholder: "https://..." })}
        {row("头像 URL", "image", { type: "url", placeholder: "头像图片链接" })}
      </div>
      <div className="mt-4">
        <Label className="text-xs text-[--color-text-secondary]">个人简介</Label>
        <Textarea
          value={value.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="用几句话描述你的背景和职业目标"
          className="mt-1 h-24 text-sm"
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {row("城市", "city", { placeholder: "如：北京" })}
        {row("地区/省份", "region", { placeholder: "如：北京" })}
        {row("国家代码", "countryCode", { placeholder: "CN" })}
      </div>
    </section>
  )
}
