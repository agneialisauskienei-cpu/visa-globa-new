export default function ReportTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-sm font-black text-slate-500">
              Įrašas
            </th>
            <th className="px-5 py-4 text-sm font-black text-slate-500">
              Būsena
            </th>
            <th className="px-5 py-4 text-sm font-black text-slate-500">
              Skyrius
            </th>
            <th className="px-5 py-4 text-sm font-black text-slate-500">
              Veiksmai
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row: any, index) => (
              <tr key={row.id ?? index} className="border-t border-slate-100">
                <td className="px-5 py-4 text-sm font-black text-slate-950">
                  {row.profile?.full_name ||
                    row.profile?.email ||
                    row.resident_code ||
                    row.medication_name ||
                    row.action ||
                    row.id ||
                    "Įrašas"}
                </td>

                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {row.status ??
                    row.current_status ??
                    (typeof row.is_active === "boolean"
                      ? row.is_active
                        ? "Aktyvus"
                        : "Neaktyvus"
                      : "—")}
                </td>

                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {row.department ?? row.rooms?.name ?? row.module ?? "—"}
                </td>

                <td className="px-5 py-4 text-sm font-black text-emerald-700">
                  Peržiūrėti
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-10 text-center text-sm font-bold text-slate-500"
              >
                Pagal pasirinktus filtrus duomenų nerasta.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}