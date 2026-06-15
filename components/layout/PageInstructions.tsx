"use client"

import { useEffect, useState } from "react"
import { Info, X } from "lucide-react"
import { usePathname } from "next/navigation"

const PAGE_NAMES: Record<string, string> = {
  activities: "Veiklos",
  audit: "Auditas",
  clients: "Klientai",
  dashboard: "Dienos apžvalga",
  employees: "Darbuotojai",
  "employee-dashboard": "Darbuotojo apžvalga",
  "employee-tasks": "Darbuotojo užduotys",
  "handover-logs": "Perdavimo žurnalai",
  inventory: "Inventorius",
  invites: "Kvietimai",
  medications: "Vaistai",
  medicine: "Medikamentų valdymas",
  "mobile-dashboard": "Mobilioji apžvalga",
  "my-profile": "Mano profilis",
  "my-residents": "Mano gyventojai",
  "my-schedule": "Mano grafikas",
  "my-tasks": "Mano užduotys",
  notifications: "Pranešimai",
  organization: "Organizacija",
  organizations: "Organizacijos",
  reports: "Ataskaitos",
  requests: "Prašymai",
  residents: "Gyventojai",
  rooms: "Kambariai",
  "super-admin": "Sistemos administravimas",
  system: "Sistemos nustatymai",
  tasks: "Užduotys",
  team: "Komanda",
}

function getPageName(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard"
  return PAGE_NAMES[segment] ?? "Šis langas"
}

export default function PageInstructions() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const pageName = getPageName(pathname)

  useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="vg-instruction-trigger"
        onClick={() => setOpen(true)}
        aria-label={`Atidaryti lango „${pageName}“ instrukciją`}
      >
        <Info aria-hidden="true" />
        Instrukcija
      </button>

      {open ? (
        <div
          className="vg-instruction-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            className="vg-instruction-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vg-instruction-title"
          >
            <header className="vg-instruction-header">
              <div>
                <p>Trumpa instrukcija</p>
                <h2 id="vg-instruction-title">{pageName}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Uždaryti instrukciją">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="vg-instruction-content">
              <article>
                <b>1</b>
                <div>
                  <h3>Peržiūrėkite informaciją</h3>
                  <p>Viršuje rasite svarbiausius rodiklius, filtrus ir šio lango veiksmus.</p>
                </div>
              </article>
              <article>
                <b>2</b>
                <div>
                  <h3>Pasirinkite įrašą</h3>
                  <p>Spustelėkite kortelę, eilutę arba pavadinimą, kad atidarytumėte išsamesnę informaciją.</p>
                </div>
              </article>
              <article>
                <b>3</b>
                <div>
                  <h3>Atlikite veiksmą</h3>
                  <p>Naudokite aiškiai pažymėtus kūrimo, redagavimo, patvirtinimo arba ataskaitų mygtukus.</p>
                </div>
              </article>
              <article>
                <b>4</b>
                <div>
                  <h3>Filtruokite ir ieškokite</h3>
                  <p>Jei sąrašas ilgas, naudokite paiešką ir filtrus. Aktyvų filtrą visada matysite paryškintą.</p>
                </div>
              </article>
            </div>

            <footer>
              <button type="button" onClick={() => setOpen(false)}>Supratau</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}
