"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Plus,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";

export default function SuperAdminDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <IconBox icon={<ShieldCheck className="h-7 w-7" />} size="lg" />
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Super administravimas
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">
                  Sistemos valdymo skydelis
                </h1>
                <p className="mt-2 text-lg font-semibold text-slate-500">
                  Globali platformos, įstaigų, naudotojų ir techninės būklės apžvalga.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-extrabold text-emerald-700 transition hover:bg-emerald-100">
                <RefreshCw className="h-4 w-4" />
                Atnaujinti
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Nauja įstaiga
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Building2 className="h-6 w-6" />}
            title="Įstaigos"
            value="12"
            meta="11 aktyvių"
            tone="emerald"
          />
          <StatCard
            icon={<Users className="h-6 w-6" />}
            title="Naudotojai"
            value="248"
            meta="17 online"
            tone="blue"
          />
          <StatCard
            icon={<TriangleAlert className="h-6 w-6" />}
            title="Rizikos"
            value="4"
            meta="reikia dėmesio"
            tone="amber"
          />
          <StatCard
            icon={<Activity className="h-6 w-6" />}
            title="Incidentai"
            value="1"
            meta="šiandien"
            tone="rose"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <h2 className="text-2xl font-black tracking-tight">Globalūs veiksmai</h2>
              <p className="mt-1 font-semibold text-slate-500">
                Pagrindinės super administratoriaus operacijos.
              </p>

              <div className="mt-6 grid flex-1 gap-4 md:grid-cols-2">
                <ActionCard title="Nauja įstaiga" desc="Sukurti naują tenantą" />
                <ActionCard title="Pakviesti adminą" desc="Suteikti įstaigos prieigą" />
                <ActionCard title="Audit žurnalas" desc="Peržiūrėti globalius įvykius" />
                <ActionCard title="Sistemos nustatymai" desc="Rolės, moduliai, limitai" />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-slate-500">
                    Audit
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Naujausi sistemos įvykiai
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Globalūs veiksmai per visas įstaigas.
                  </p>
                </div>
                <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200">
                  Visi
                </button>
              </div>

              <div className="mt-5 flex-1 space-y-3">
                <AuditItem
                  icon={<Building2 className="h-5 w-5" />}
                  title="Sukurta nauja įstaiga"
                  meta="Globos namai „Rūta“ · prieš 12 min"
                  tone="emerald"
                />
                <AuditItem
                  icon={<UserPlus className="h-5 w-5" />}
                  title="Pakviestas įstaigos administratorius"
                  meta="Vilties namai · prieš 1 val."
                  tone="blue"
                />
                <AuditItem
                  icon={<Settings className="h-5 w-5" />}
                  title="Pakeisti modulio limitai"
                  meta="Personalo modulis · vakar"
                  tone="amber"
                />
                <AuditItem
                  icon={<AlertCircle className="h-5 w-5" />}
                  title="Prisijungimo klaidų pikas"
                  meta="3 bandymai iš vieno IP · vakar"
                  tone="rose"
                />
              </div>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                    Platforma
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Sistemos santrauka
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Bendra platformos būsena ir naudojimas.
                  </p>
                </div>
                <IconBox icon={<Server className="h-6 w-6" />} />
              </div>

              <div className="mt-6 grid flex-1 gap-3 sm:grid-cols-2">
                <SummaryCard title="Aktyvios sesijos" value="17 online" tone="emerald" />
                <SummaryCard title="Kvietimai" value="5 laukia" tone="amber" />
                <SummaryCard title="Backup" value="Prieš 2 val." tone="emerald" />
                <SummaryCard title="API" value="124ms" tone="emerald" />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-amber-600">
                    Rizikos
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Reikia super admin dėmesio
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Sisteminės problemos ir administravimo rizikos.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <TriangleAlert className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 flex-1 space-y-3">
                <RiskCard
                  title="Įstaiga be administratoriaus"
                  desc="1 aktyvi įstaiga neturi paskirto admino."
                  badge="Svarbu"
                  tone="amber"
                />
                <RiskCard
                  title="Prisijungimo anomalija"
                  desc="Pastebėtas neįprastas nepavykusių bandymų kiekis."
                  badge="Skubu"
                  tone="rose"
                />
                <RiskCard
                  title="Neaktyvūs tenantai"
                  desc="2 įstaigos neturėjo aktyvumo 30 dienų."
                  badge="Sekti"
                  tone="blue"
                />
                <RiskCard
                  title="Backup patikra"
                  desc="Paskutinis backup sėkmingas, rekomenduojama patikra."
                  badge="Peržiūrėti"
                  tone="emerald"
                />
              </div>
            </Card>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Globali statistika
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Platformos rodikliai
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Greitai įvertinami techniniai ir verslo rodikliai.
              </p>
            </div>

            <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200">
              Peržiūrėti ataskaitą
            </button>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <ChartCard title="Tenant aktyvumas" value="91%" progress={91} color="#10b981" desc="Aktyvių įstaigų dalis per 30 dienų." />
            <ChartCard title="API stabilumas" value="99%" progress={99} color="#0f766e" desc="Sėkmingų API atsakymų santykis." />
            <ChartCard title="Kvietimai" value="5" progress={30} color="#f59e0b" desc="Laukiantys administratorių kvietimai." />
            <ChartCard title="Saugumo rizika" value="1" progress={20} color="#f43f5e" desc="Atviri saugumo įspėjimai." />
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </article>
  );
}

function IconBox({
  icon,
  size = "md",
}: {
  icon: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={
        size === "lg"
          ? "flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700"
          : "flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"
      }
    >
      {icon}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
  tone: "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>
        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-black">
            {value} <span className={`text-sm font-bold ${toneClass.split(" ").at(-1)}`}>{meta}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function ActionCard({ title, desc }: { title: string; desc: string }) {
  return (
    <button className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
      <span>
        <b>{title}</b>
        <br />
        <small className="font-semibold text-slate-500">{desc}</small>
      </span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function AuditItem({
  icon,
  title,
  meta,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  tone: "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
        {icon}
      </div>
      <div>
        <b>{title}</b>
        <p className="text-sm font-bold text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "emerald" | "amber";
}) {
  const textClass = tone === "amber" ? "text-amber-700" : "text-emerald-700";

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black text-slate-800">{title}</p>
      <p className={`mt-1 text-sm font-black ${textClass}`}>{value}</p>
    </div>
  );
}

function RiskCard({
  title,
  desc,
  badge,
  tone,
}: {
  title: string;
  desc: string;
  badge: string;
  tone: "amber" | "rose" | "blue" | "emerald";
}) {
  const toneClass = {
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${toneClass}`}>
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">{desc}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black">
        {badge}
      </span>
    </div>
  );
}

function ChartCard({
  title,
  value,
  progress,
  color,
  desc,
}: {
  title: string;
  value: string;
  progress: number;
  color: string;
  desc: string;
}) {
  const circumference = 301;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <article className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <h3 className="mt-2 text-4xl font-black tracking-tight">{value}</h3>
        </div>

        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="-rotate-90 transform" width="96" height="96" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" stroke="#e2e8f0" strokeWidth="10" fill="none" />
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute text-lg font-black">{value}</span>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500">{desc}</p>
    </article>
  );
}
