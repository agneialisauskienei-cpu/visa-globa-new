"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  Home,
  Plus,
  RefreshCw,
  Users,
  UserPlus,
  X,
} from "lucide-react";

type View = "dashboard" | "residents" | "employees" | "requests" | "audit" | "report";

type ModalType = null | "resident" | "employee" | "request" | "record";

const viewTitles: Record<View, string> = {
  dashboard: "Pagrindinis skydelis",
  residents: "Gyventojai",
  employees: "Darbuotojai",
  requests: "Užklausos",
  audit: "Audit žurnalas",
  report: "Ataskaita",
};

export default function AdminDashboardPage() {
  const [view, setView] = useState<View>("dashboard");
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const pageDescription = useMemo(() => {
    if (view === "dashboard") return "Greita įstaigos statistika, personalo prioritetai ir pagrindiniai valdymo veiksmai.";
    if (view === "residents") return "Gyventojų sąrašas, statusai ir pagrindiniai veiksmai.";
    if (view === "employees") return "Darbuotojų sąrašas, rolės, pažymos ir aktyvumas.";
    if (view === "requests") return "Naujos ir suplanuotos užklausos, kurias reikia peržiūrėti.";
    if (view === "audit") return "Paskutiniai sistemos pakeitimai ir administraciniai veiksmai.";
    return "Svarbiausi įstaigos rodikliai vienoje vietoje.";
  }, [view]);

  const finishAction = (text: string) => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setModal(null);
      setNotice(text);
      window.setTimeout(() => setNotice(""), 3000);
    }, 500);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        {notice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-extrabold text-emerald-700 shadow-sm">
            {notice}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setView("dashboard")}
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
                aria-label="Grįžti į dashboard"
              >
                <Home className="h-7 w-7" />
              </button>

              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Sistemos apžvalga
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">{viewTitles[view]}</h1>
                <p className="mt-2 text-lg font-semibold text-slate-500">{pageDescription}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => finishAction("Duomenys atnaujinti")}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-extrabold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Atnaujinama..." : "Atnaujinti"}
              </button>
              <button
                onClick={() => setModal("record")}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Naujas įrašas
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Building2 />} title="Įstaigos" value="1" meta="Aktyvi" onClick={() => setView("report")} />
          <StatCard icon={<Users />} title="Gyventojai" value="2" meta="+1 savaitę" onClick={() => setView("residents")} />
          <StatCard icon={<UserPlus />} title="Darbuotojai" value="2" meta="2 aktyvūs" onClick={() => setView("employees")} />
          <StatCard icon={<ClipboardList />} title="Užklausos" value="0" meta="Nėra" onClick={() => setView("requests")} />
        </section>

        {view === "dashboard" && <DashboardView setView={setView} setModal={setModal} />}
        {view === "residents" && <ListView title="Gyventojai" cta="Pridėti gyventoją" onAdd={() => setModal("resident")} rows={["Jonas Petraitis · Aktyvus", "Ona Kazlauskienė · Aktyvi"]} />}
        {view === "employees" && <ListView title="Darbuotojai" cta="Pridėti darbuotoją" onAdd={() => setModal("employee")} rows={["Rasa Jonaitienė · Administratorė", "Mantas Petrauskas · Slaugytojas"]} />}
        {view === "requests" && <ListView title="Užklausos" cta="Nauja užklausa" onAdd={() => setModal("request")} rows={["Atostogų prašymas · Laukia peržiūros", "Grafiko pakeitimas · Suplanuota"]} />}
        {view === "audit" && <ListView title="Audit žurnalas" cta="Eksportuoti" onAdd={() => finishAction("Audit žurnalas eksportuotas")} rows={["Atnaujinta darbuotojo rolė · prieš 8 min", "Pakeistas darbuotojo skyrius · prieš 2 val.", "Priimtas kvietimas · 2026-04-27"]} />}
        {view === "report" && <ReportView />}
      </div>

      {modal && <ActionModal type={modal} loading={loading} onClose={() => setModal(null)} onSave={() => finishAction("Veiksmas atliktas sėkmingai")} />}
    </main>
  );
}

function DashboardView({ setView, setModal }: { setView: (view: View) => void; setModal: (modal: ModalType) => void }) {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <Card className="min-h-[286px]">
            <h2 className="text-2xl font-black tracking-tight">Greiti veiksmai</h2>
            <p className="mt-1 font-semibold text-slate-500">Dažniausiai naudojamos administravimo operacijos.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ActionCard title="Naujas gyventojas" desc="Pridėti gyventojo profilį" onClick={() => setModal("resident")} />
              <ActionCard title="Naujas darbuotojas" desc="Sukurti darbuotojo paskyrą" onClick={() => setModal("employee")} />
              <ActionCard title="Nauja užklausa" desc="Registruoti užklausą" onClick={() => setModal("request")} />
              <ActionCard title="Audit žurnalas" desc="Peržiūrėti pakeitimus" onClick={() => setView("audit")} />
            </div>
          </Card>

          <Card className="min-h-[370px]">
            <h2 className="text-2xl font-black tracking-tight">Naujausias aktyvumas</h2>
            <p className="mt-1 font-semibold text-slate-500">Paskutiniai administraciniai veiksmai sistemoje.</p>
            <div className="mt-5 space-y-3">
              <ActivityItem title="Atnaujinta darbuotojo rolė" meta="Darbuotojai · prieš 8 min" />
              <ActivityItem title="Pakeistas darbuotojo skyrius" meta="Darbuotojai · prieš 2 val." />
              <ActivityItem title="Priimtas kvietimas" meta="Kvietimai · 2026-04-27" />
              <ActivityItem title="Pateiktas atostogų prašymas" meta="Personalas · šiandien" />
            </div>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="min-h-[286px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">Šiandien</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Direktoriaus santrauka</h2>
                <p className="mt-1 font-semibold text-slate-500">Svarbiausi rodikliai ir veiksmai vienoje vietoje.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CalendarCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SummaryCard title="Gyventojai" value="2 aktyvūs" onClick={() => setView("residents")} />
              <SummaryCard title="Darbuotojai" value="2 aktyvūs" onClick={() => setView("employees")} />
              <SummaryCard title="Užklausos" value="0 laukia" muted onClick={() => setView("requests")} />
              <SummaryCard title="Kvietimai" value="0 nepatvirtintų" muted onClick={() => setModal("record")} />
            </div>
          </Card>

          <Card className="min-h-[370px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-amber-600">Prioritetai</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Reikia dėmesio</h2>
                <p className="mt-1 font-semibold text-slate-500">Personalo, pažymų, mokymų ir atostogų klausimai.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <PriorityCard title="Darbuotojų trūkumas" desc="Trūksta 2 darbuotojų rytinei pamainai." color="amber" badge="Svarbu" onClick={() => setView("employees")} />
              <PriorityCard title="Baigiasi pažymos" desc="3 darbuotojų pažymos baigsis per 14 dienų." color="red" badge="Skubu" onClick={() => setView("employees")} />
              <PriorityCard title="Neužbaigti mokymai" desc="2 darbuotojai nebaigė privalomų mokymų." color="blue" badge="Sekti" onClick={() => setView("employees")} />
              <PriorityCard title="Atostogų prašymai" desc="1 naujas prašymas laukia patvirtinimo." color="emerald" badge="Peržiūrėti" onClick={() => setView("requests")} />
            </div>
          </Card>
        </div>
      </section>

      <ReportView />
    </>
  );
}

function ReportView() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">Statistika</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Įstaigos rodikliai</h2>
          <p className="mt-1 font-semibold text-slate-500">Greitai įvertinami rodikliai direktoriui.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Užimtumas" value="82%" progress={82} color="#10b981" desc="Gyventojų vietų užpildymas." />
        <ChartCard title="Mokymai" value="68%" progress={68} color="#3b82f6" desc="Privalomų mokymų užbaigimas." />
        <ChartCard title="Pažymos" value="3" progress={25} color="#f43f5e" desc="Baigiasi per 14 dienų." />
        <ChartCard title="Atostogos" value="1" progress={40} color="#f59e0b" desc="Laukia sprendimo." />
      </div>
    </section>
  );
}

function ListView({ title, rows, cta, onAdd }: { title: string; rows: string[]; cta: string; onAdd: () => void }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <button onClick={onAdd} className="rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white transition hover:bg-slate-800 active:scale-[0.98]">
          {cta}
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <button key={row} onClick={onAdd} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left font-bold transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]">
            {row}
            <ArrowRight className="h-5 w-5 text-slate-400" />
          </button>
        ))}
      </div>
    </section>
  );
}

function ActionModal({ type, loading, onClose, onSave }: { type: Exclude<ModalType, null>; loading: boolean; onClose: () => void; onSave: () => void }) {
  const titles = {
    resident: "Naujas gyventojas",
    employee: "Naujas darbuotojas",
    request: "Nauja užklausa",
    record: "Naujas įrašas",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{titles[type]}</h2>
            <p className="mt-1 font-semibold text-slate-500">Užpildykite informaciją ir išsaugokite.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 font-extrabold text-slate-700">
            Pavadinimas / vardas
            <input required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none transition focus:border-emerald-300 focus:bg-white" placeholder="Įveskite reikšmę" />
          </label>
          <label className="grid gap-2 font-extrabold text-slate-700">
            Pastaba
            <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none transition focus:border-emerald-300 focus:bg-white" placeholder="Papildoma informacija" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 font-extrabold text-slate-700 transition hover:bg-slate-50">
            Atšaukti
          </button>
          <button type="submit" disabled={loading} className="rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-60">
            {loading ? "Saugoma..." : "Išsaugoti"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</article>;
}

function StatCard({ icon, title, value, meta, onClick }: { icon: React.ReactNode; title: string; value: string; meta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md active:scale-[0.99]">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-black">{value} <span className="text-sm font-bold text-emerald-700">{meta}</span></p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]">
      <span><b>{title}</b><br /><small className="font-semibold text-slate-500">{desc}</small></span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function ActivityItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600"><CalendarCheck className="h-5 w-5" /></div>
      <div><b>{title}</b><p className="text-sm font-bold text-slate-500">{meta}</p></div>
    </div>
  );
}

function SummaryCard({ title, value, muted = false, onClick }: { title: string; value: string; muted?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50 active:scale-[0.99]">
      <p className="font-black text-slate-800">{title}</p>
      <p className={`mt-1 text-sm font-black ${muted ? "text-slate-600" : "text-emerald-700"}`}>{value}</p>
    </button>
  );
}

function PriorityCard({ title, desc, badge, color, onClick }: { title: string; desc: string; badge: string; color: "amber" | "red" | "blue" | "emerald"; onClick: () => void }) {
  const styles = { amber: "border-amber-100 bg-amber-50 text-amber-700", red: "border-red-100 bg-red-50 text-red-700", blue: "border-blue-100 bg-blue-50 text-blue-700", emerald: "border-emerald-100 bg-emerald-50 text-emerald-700" }[color];
  return (
    <button onClick={onClick} className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition hover:shadow-md active:scale-[0.99] ${styles}`}>
      <div><p className="font-black text-slate-900">{title}</p><p className="mt-1 text-sm font-semibold text-slate-600">{desc}</p></div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black">{badge}</span>
    </button>
  );
}

function ChartCard({ title, value, progress, color, desc }: { title: string; value: string; progress: number; color: string; desc: string }) {
  const circumference = 301;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <article className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">{title}</p><h3 className="mt-2 text-4xl font-black tracking-tight">{value}</h3></div>
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="-rotate-90 transform" width="96" height="96" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" stroke="#e2e8f0" strokeWidth="10" fill="none" />
            <circle cx="60" cy="60" r="48" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <span className="absolute text-lg font-black">{value}</span>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{desc}</p>
    </article>
  );
}
