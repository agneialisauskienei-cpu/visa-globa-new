import { ReportStat } from "@/lib/reports/types"

const toneClassMap = {
  default: "border-slate-200 bg-white text-slate-950",
  success: "border-emerald-100 bg-emerald-50/60 text-emerald-800",
  warning: "border-orange-100 bg-orange-50/70 text-orange-800",
  danger: "border-red-100 bg-red-50/70 text-red-800",
}

export default function ReportStatCard({ stat }: { stat: ReportStat }) {
  const tone = stat.tone ?? "default"

  return (
    <div className={`rounded-[26px] border p-6 shadow-sm ${toneClassMap[tone]}`}>
      <p className="text-sm font-black opacity-75">{stat.label}</p>
      <div className="mt-2 text-4xl font-black">{stat.value}</div>
      {stat.description ? (
        <p className="mt-3 text-sm font-bold leading-6 opacity-70">{stat.description}</p>
      ) : null}
    </div>
  )
}