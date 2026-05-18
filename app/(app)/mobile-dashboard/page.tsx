export default function MobileEmployeeDashboard() {
  return (
    <main className="min-h-screen bg-[#f7faf8] pb-24 text-slate-950">
      <div className="mx-auto max-w-[430px] px-4 py-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
            ŠIANDIEN
          </p>

          <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.04em] text-slate-950">
            Viskas vienoje vietoje
          </h1>

          <p className="mt-4 text-[17px] font-semibold leading-7 text-slate-500">
            Grafikas, užduotys, dokumentai ir svarbūs pranešimai.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button className="rounded-[22px] bg-[#f4f7f5] px-4 py-5 text-left transition hover:bg-[#edf3ef]">
              <p className="text-[30px] font-black tracking-tight">0</p>
              <span className="mt-4 block text-sm font-bold text-slate-700">
                Užduočių
              </span>
            </button>

            <button className="rounded-[22px] bg-[#eef8f4] px-4 py-5 text-left transition hover:bg-[#e4f4ed]">
              <p className="text-[30px] font-black tracking-tight text-emerald-800">
                2
              </p>
              <span className="mt-4 block text-sm font-bold text-slate-700">
                Pranešimai
              </span>
            </button>

            <button className="rounded-[22px] bg-[#fff7ed] px-4 py-5 text-left transition hover:bg-[#ffedd5]">
              <p className="text-[30px] font-black tracking-tight text-amber-700">
                33%
              </p>
              <span className="mt-4 block text-sm font-bold text-slate-700">
                Dokumentai
              </span>
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600">
                PRANEŠIMAI
              </p>

              <h2 className="mt-2 text-[26px] font-black tracking-tight text-slate-950">
                Nauji pranešimai
              </h2>
            </div>

            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
              2 nauji
            </span>
          </div>

          <p className="mt-4 text-[15px] font-semibold leading-6 text-slate-500">
            Peržiūrėkite dokumentų ir profilio informaciją.
          </p>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <button className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-lg font-black tracking-tight">Profilis</p>
            <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">
              Kontaktai ir asmeniniai duomenys
            </p>
          </button>

          <button className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-lg font-black tracking-tight">Grafikas</p>
            <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">
              Pamainos ir neatvykimai
            </p>
          </button>

          <button className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-lg font-black tracking-tight">Užduotys</p>
            <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">
              Darbai ir priminimai
            </p>
          </button>

          <button className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-lg font-black tracking-tight">Dokumentai</p>
            <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">
              Pažymos ir licencijos
            </p>
          </button>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[430px] grid-cols-5 gap-1">
          <button className="rounded-2xl bg-emerald-800 px-2 py-2.5 text-xs font-black text-white">
            Pradžia
          </button>

          <button className="rounded-2xl px-2 py-2.5 text-xs font-black text-slate-500">
            Grafikas
          </button>

          <button className="rounded-2xl px-2 py-2.5 text-xs font-black text-slate-500">
            Užduotys
          </button>

          <button className="relative rounded-2xl px-2 py-2.5 text-xs font-black text-slate-500">
            Žinutės
            <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
          </button>

          <button className="rounded-2xl px-2 py-2.5 text-xs font-black text-slate-500">
            Profilis
          </button>
        </div>
      </nav>
    </main>
  )
}
