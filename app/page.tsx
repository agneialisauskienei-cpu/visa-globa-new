'use client'

import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Heart,
  HeartPulse,
  Home,
  LayoutDashboard,
  LockKeyhole,
  Pill,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  const goLogin = () => router.push('/login')

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_8%,rgba(16,185,129,0.13),transparent_28%),linear-gradient(180deg,#fbfdfc_0%,#eef5f1_100%)] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-slate-50/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-4 px-4 sm:h-[76px] sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-[22px]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-900 text-white shadow-[0_14px_34px_rgba(6,78,59,0.22)]">
              <Heart className="h-5 w-5" />
            </span>
            VisaGloba
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            <button type="button" onClick={() => scrollTo('modules')} className="text-sm font-extrabold text-slate-600 transition hover:text-slate-950">
              Moduliai
            </button>
            <button type="button" onClick={() => scrollTo('dashboard')} className="text-sm font-extrabold text-slate-600 transition hover:text-slate-950">
              Darbalaukis
            </button>
            <button type="button" onClick={() => scrollTo('workflow')} className="text-sm font-extrabold text-slate-600 transition hover:text-slate-950">
              Procesai
            </button>
            <button type="button" onClick={() => scrollTo('contact')} className="text-sm font-extrabold text-slate-600 transition hover:text-slate-950">
              Kontaktai
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goLogin}
              className="hidden rounded-2xl border border-emerald-950/15 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
            >
              Prisijungti
            </button>
            <button
              type="button"
              onClick={goLogin}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-900 px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-emerald-800"
            >
              Pradėti
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-12">
        <div className="grid items-stretch gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="flex flex-col justify-between rounded-[30px] border border-emerald-950/10 bg-white/75 p-5 shadow-[0_18px_56px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[38px] sm:p-8">
            <div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 sm:text-sm">
                Globos įstaigų darbo centras
              </span>

              <h1 className="mt-5 text-[42px] font-black leading-[0.98] tracking-[-0.06em] text-slate-950 sm:text-[62px] sm:leading-[0.96] sm:tracking-[-0.075em]">
                Matykite ne tik sąrašus, bet ir{' '}
                <span className="text-emerald-700">visą dienos pulsą.</span>
              </h1>

              <p className="mt-6 text-base font-bold leading-7 text-slate-600 sm:text-[19px] sm:leading-8">
                VisaGloba sujungia gyventojus, pamainas, užduotis, pranešimus
                ir ataskaitas į vieną aiškų darbalaukį. Vadovui — bendras
                vaizdas, darbuotojui — tik tai, kas svarbu dabar.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goLogin}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-5 py-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(6,78,59,0.18)] transition hover:bg-emerald-800"
                >
                  Prisijungti prie sistemos
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo('dashboard')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-950/15 bg-white px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Peržiūrėti darbalaukį
                </button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
              <TrustCard value="124" label="Gyventojai" />
              <TrustCard value="18" label="Pamainos" />
              <TrustCard value="7" label="Rizikos" />
            </div>
          </div>

          <DesktopDashboardPreview />

          <MobileDashboardPreview />
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Moduliai
          </p>
          <h2 className="mt-3 text-[33px] font-black leading-tight tracking-[-0.055em] text-slate-950 sm:text-[44px]">
            Darbo vieta, kuri rodo prioritetus, o ne tik meniu punktus.
          </h2>
          <p className="mt-4 text-base font-bold leading-7 text-slate-600 sm:text-lg">
            Kiekvienas modulis turi aiškų tikslą: sumažinti praleistą
            informaciją, paspartinti pamainą ir palikti auditinį pėdsaką.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users />}
            title="Gyventojai"
            desc="Priskyrimai, kambariai, būklės pokyčiai, rizikos ir susiję įrašai vienoje kortelėje."
          />
          <FeatureCard
            icon={<ClipboardList />}
            title="Perdavimai"
            desc="Auditinis pamainų perdavimas, patvirtinimai, atsakomybės tęstinumas ir matymo istorija."
          />
          <FeatureCard
            icon={<CalendarDays />}
            title="Grafikai"
            desc="Pamainos, neatvykimai, prašymai, konfliktai ir darbuotojo mobilus grafikas."
          />
          <FeatureCard
            icon={<Pill />}
            title="Medicina"
            desc="Vaistų žymėjimas, praleidimai, kritiniai priminimai ir atsakomybės kontrolė."
          />
          <FeatureCard
            icon={<Bell />}
            title="Pranešimai"
            desc="Skirtingi svarbos lygiai, garsas tik kritiniams, veiksmo kortelės ir eskalavimas."
          />
          <FeatureCard
            icon={<ShieldCheck />}
            title="BDAR ir teisės"
            desc="Rolės, matomumo ribojimas, jautrių duomenų maskavimas ir auditinis pėdsakas."
          />
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="grid gap-6 rounded-[30px] bg-[#0b1f17] p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:rounded-[34px] sm:p-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-[31px] font-black leading-tight tracking-[-0.055em] sm:text-[38px]">
              Aiškus kelias nuo įvykio iki atsakomybės.
            </h2>
            <p className="mt-4 font-bold leading-7 text-slate-300">
              Pranešimas → veiksmas → patvirtinimas → auditas. Tokia eiga
              padeda nepalikti svarbios informacijos tik žodiniame perdavime.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
            <FlowRow left="Kritinis įvykis" right="Garsinis pranešimas" />
            <FlowRow left="Darbuotojo veiksmas" right="Patvirtinimas" />
            <FlowRow left="Perdavimas" right="Auditinis pėdsakas" />
          </div>
        </div>
      </section>

      <section id="contact" className="mt-8 bg-[#0b1f17] text-white">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-[33px] font-black leading-tight tracking-[-0.055em] sm:text-[42px]">
              Norite pritaikyti savo įstaigai?
            </h2>
            <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-slate-300 sm:text-lg">
              Prisijunkite prie sistemos arba paruoškite demonstraciją pagal
              jūsų procesus: gyventojus, grafikus, perdavimus, mokymus ir
              pranešimus.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={goLogin}
              className="rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white transition hover:bg-emerald-600"
            >
              Prisijungti
            </button>
            <button
              type="button"
              onClick={() => scrollTo('modules')}
              className="rounded-2xl border border-white/15 bg-white px-6 py-4 text-sm font-black text-slate-800"
            >
              Peržiūrėti modulius
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function TrustCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[20px] border border-emerald-950/10 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:rounded-[22px] sm:p-4">
      <b className="block text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-2xl">
        {value}
      </b>
      <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">
        {label}
      </span>
    </div>
  )
}

function DesktopDashboardPreview() {
  const menu = [
    'Pagrindinis',
    'Gyventojai',
    'Grafikas',
    'Užduotys',
    'Perdavimai',
    'Medicina',
    'Pranešimai',
    'Ataskaitos',
  ]

  return (
    <div id="dashboard" className="hidden overflow-hidden rounded-[38px] border border-emerald-950/10 bg-white shadow-[0_34px_90px_rgba(15,23,42,0.14)] lg:block">
      <div className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
          Pagrindinis darbalaukis · šiandien
        </div>
      </div>

      <div className="grid min-h-[620px] grid-cols-[214px_1fr]">
        <aside className="bg-emerald-900 p-4 text-white">
          <div className="mb-6 text-lg font-black">VisaGloba</div>
          <nav className="space-y-1">
            {menu.map((item, index) => (
              <div
                key={item}
                className={`rounded-2xl px-3 py-3 text-sm font-bold ${
                  index === 0 ? 'bg-white text-emerald-900' : 'text-emerald-50/90'
                }`}
              >
                {item}
              </div>
            ))}
          </nav>

          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/10 p-4">
            <b className="block text-sm">Administratorė</b>
            <span className="mt-1 block text-xs text-emerald-100">
              Šiandien aktyvu 26 darbuotojai
            </span>
          </div>
        </aside>

        <div className="bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                Organizacijos darbalaukis
              </p>
              <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em]">
                Šiandienos situacija
              </h2>
            </div>
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">
              Ataskaita
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <PreviewStat value="124" label="Gyventojai" />
            <PreviewStat value="93%" label="Užimtumas" />
            <PreviewStat value="18" label="Pamainos" />
            <PreviewStat value="7" label="Dėmesio" />
          </div>

          <div className="mt-3 grid grid-cols-[1.05fr_0.95fr] gap-3">
            <PreviewPanel title="Gyventojų pasiskirstymo diagrama" desc="Užimtumo, priežiūros lygio ir paslaugų vaizdas.">
              <div className="mt-4 grid grid-cols-[160px_1fr] items-center gap-4">
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(#064e3b_0_48%,#10b981_48%_72%,#86efac_72%_88%,#e2e8f0_88%_100%)]">
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                    <b className="text-2xl font-black">124</b>
                    <span className="text-[11px] font-bold text-slate-500">iš viso</span>
                  </div>
                </div>
                <div className="space-y-2 text-xs font-bold text-slate-600">
                  <Legend label="Ilgalaikė globa" value="48%" color="#064e3b" />
                  <Legend label="Slauga" value="24%" color="#10b981" />
                  <Legend label="Trumpalaikė" value="16%" color="#86efac" />
                  <Legend label="Laisvos vietos" value="12%" color="#e2e8f0" />
                </div>
              </div>
            </PreviewPanel>

            <PreviewPanel title="Rizikos ir krūvis" desc="Kas reikalauja vadovo dėmesio.">
              <div className="mt-4 space-y-3">
                <RiskBar label="Vaistų vėlavimai" value="32%" width="32%" />
                <RiskBar label="Neuždaryti perdavimai" value="64%" width="64%" />
                <RiskBar label="Darbuotojų trūkumas" value="48%" width="48%" />
              </div>
            </PreviewPanel>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <PreviewPanel title="Dabar svarbu">
              <Notice icon={<AlertTriangle />} title="2 kritiniai pranešimai" text="Vienas laukia patvirtinimo." />
              <Notice icon={<ClipboardList />} title="5 perdavimo įrašai" text="3 dar neperžiūrėti." />
            </PreviewPanel>

            <PreviewPanel title="Greiti veiksmai">
              <Notice icon={<CheckCircle2 />} title="Sukurti užduotį" text="Ūkis, slauga arba administracija." />
              <Notice icon={<CalendarDays />} title="Atidaryti grafiką" text="Pamainos ir neatvykimai." />
            </PreviewPanel>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileDashboardPreview() {
  return (
    <div className="mt-5 overflow-hidden rounded-[34px] border border-emerald-950/10 bg-slate-50 shadow-[0_26px_60px_rgba(15,23,42,0.16)] lg:hidden">
      <section className="rounded-b-[34px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 p-5 pb-7 text-white">
        <div className="flex justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/10">
            <Home className="h-5 w-5" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/10">
            <RefreshCw className="h-5 w-5" />
          </div>
        </div>

        <p className="mt-7 text-[11px] font-black uppercase tracking-[0.28em] text-emerald-100">
          Mobilus režimas
        </p>
        <h2 className="mt-3 text-[34px] font-black leading-none tracking-[-0.055em]">
          Darbuotojui telefone
        </h2>
        <p className="mt-3 font-bold leading-6 text-emerald-50">
          Kritiniai pranešimai, grafikas, gyventojai ir užduotys matomi pamainos metu.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MobileStat value="2" label="Kritiniai" />
          <MobileStat value="5" label="Veiksmai" />
          <MobileStat value="14" label="Visi" />
        </div>
      </section>

      <div className="space-y-3 p-4 pb-8">
        <div className="rounded-[26px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100">
                Pamaina dabar
              </p>
              <h3 className="mt-2 text-lg font-black">3 svarbūs veiksmai</h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <Bell className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <MobileAction title="Vaistų žymėjimas" meta="08:45" />
            <MobileAction title="Perdavimas laukia" meta="2 nauji" />
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <h3 className="text-lg font-black">Darbalaukio diagrama</h3>
          <div className="mt-3 grid grid-cols-[118px_1fr] items-center gap-3">
            <div className="flex h-[118px] w-[118px] items-center justify-center rounded-full bg-[conic-gradient(#064e3b_0_48%,#10b981_48%_72%,#86efac_72%_88%,#e2e8f0_88%_100%)]">
              <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white text-lg font-black">
                124
              </div>
            </div>
            <p className="text-sm font-bold leading-6 text-slate-600">
              Gyventojų pasiskirstymas ir laisvos vietos matomos net telefone.
            </p>
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <h3 className="text-lg font-black">Reikia dėmesio</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            Vaistai, incidentai ir perdavimai rodomi pirmiausia.
          </p>
        </div>
      </div>
    </div>
  )
}

function PreviewStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <b className="block text-2xl font-black tracking-[-0.05em]">{value}</b>
      <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.11em] text-slate-500">
        {label}
      </span>
    </div>
  )
}

function PreviewPanel({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <h3 className="text-[17px] font-black tracking-[-0.03em]">{title}</h3>
      {desc ? <p className="mt-1 text-xs font-bold text-slate-500">{desc}</p> : null}
      {children}
    </section>
  )
}

function Legend({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        <i
          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}

function RiskBar({
  label,
  value,
  width,
}: {
  label: string
  value: string
  width: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-black text-slate-600">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-700" style={{ width }} />
      </div>
    </div>
  )
}

function Notice({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="mt-2.5 flex gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <div>
        <b className="text-[13px]">{title}</b>
        <span className="mt-0.5 block text-xs font-bold text-slate-500">{text}</span>
      </div>
    </div>
  )
}

function MobileStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[22px] bg-white/15 p-3 backdrop-blur">
      <b className="text-[22px] font-black">{value}</b>
      <span className="mt-1 block text-[10px] font-black uppercase text-emerald-50">
        {label}
      </span>
    </div>
  )
}

function MobileAction({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex justify-between gap-2 rounded-2xl bg-white/10 px-3 py-3">
      <span className="text-sm font-extrabold">{title}</span>
      <b className="text-xs">{meta}</b>
    </div>
  )
}

function FlowRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="mb-2.5 grid grid-cols-[1fr_34px_1fr] items-center gap-2.5 last:mb-0">
      <div className="rounded-2xl bg-white p-3 text-sm font-black text-slate-950">
        {left}
      </div>
      <div className="text-center font-black text-emerald-100">→</div>
      <div className="rounded-2xl bg-white p-3 text-sm font-black text-slate-950">
        {right}
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <article className="rounded-[28px] border border-emerald-950/10 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
      <div className="flex h-13 w-13 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-700 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
        {desc}
      </p>
    </article>
  )
}
