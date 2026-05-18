export default function RequestsPage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Prašymai
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Prašymai ir neatvykimai
        </h1>

        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Čia bus darbuotojų atostogų, trumpų išvykimų, mamadienių,
          tėvadienių, nedarbingumo ir kitų neatvykimų prašymai.
        </p>

        <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-sm text-emerald-900">
          Modulis ruošiama prijungti prie grafikų ir patvirtinimų sistemos.
        </div>
      </section>
    </main>
  )
}
