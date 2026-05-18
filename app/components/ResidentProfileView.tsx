export default function ResidentProfileView() {
  return (
    <div className="rounded-3xl border border-[#dfe7df] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Gyventojo kortelė</p>
          <h1 className="text-3xl font-bold tracking-tight">Ona Petrauskienė</h1>
        </div>

        <div className="flex gap-2">
          <button className="rounded-xl border px-4 py-2 text-sm font-semibold">
            Naujas įrašas
          </button>

          <button className="rounded-xl bg-[#31453a] px-4 py-2 text-sm font-semibold text-white">
            Redaguoti
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <h2 className="mb-4 text-lg font-bold">Pagrindinė informacija</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Statusas</span>
              <span className="font-semibold">Gyvena</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Kambarys</span>
              <span className="font-semibold">204</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Priežiūra</span>
              <span className="font-semibold">Dalinė slauga</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Asmens kodas</span>
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs">
                •••••••••••
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-5">
          <h2 className="mb-4 text-lg font-bold">ISGP santrauka</h2>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-[#eef5ef] p-3">
              Priminti gerti vandenį ir skatinti dalyvauti veiklose.
            </div>

            <div className="rounded-xl bg-[#eef5ef] p-3">
              Naudoti vaikštynę einant ilgesnius atstumus.
            </div>

            <div className="rounded-xl bg-[#eef5ef] p-3">
              Vengti triukšmingos aplinkos.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-5">
          <h2 className="mb-4 text-lg font-bold">Lankomumas</h2>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Rytinė mankšta</div>
              <div className="text-gray-500">Dalyvavo</div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="font-semibold">Dailė</div>
              <div className="text-gray-500">Atsisakė</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
