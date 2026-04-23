'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  PlayCircle,
  Users,
  CalendarDays,
  FileText,
  HeartPulse,
  BarChart3,
  ShieldCheck,
  Phone,
  Mail,
  Check,
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  const goLogin = () => router.push('/login')

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#0b1f17]" />

      <main className="min-h-screen text-white">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b1f17]/60 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-2xl font-bold tracking-tight"
            >
              VisaGloba
            </button>

            <nav className="hidden items-center gap-8 md:flex">
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="text-sm font-medium text-slate-200 transition hover:text-white"
              >
                Funkcijos
              </button>
              <button
                type="button"
                onClick={() => scrollTo('pricing')}
                className="text-sm font-medium text-slate-200 transition hover:text-white"
              >
                Kainos
              </button>
              <button
                type="button"
                onClick={() => scrollTo('contact')}
                className="text-sm font-medium text-slate-200 transition hover:text-white"
              >
                Kontaktai
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goLogin}
                className="hidden text-sm font-medium text-slate-200 transition hover:text-white sm:block"
              >
                Prisijungti
              </button>

              <button
                type="button"
                onClick={goLogin}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Pradėti nemokamai
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </header>

        <section className="relative flex min-h-screen items-center overflow-hidden pt-24">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-35"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1586105251261-72a756497a11?q=80&w=2000&auto=format&fit=crop')",
              }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.18),transparent_35%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07140f] via-[#0b1f17]/92 to-[#0b1f17]/45" />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1.02fr_1fr]">
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
            >
              <div className="mb-5 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
                Sukurta globos įstaigoms
              </div>

              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                Mažiau klaidų.
                <br />
                Mažiau chaoso.
                <br />
                <span className="text-emerald-400">Daugiau kontrolės.</span>
              </h1>

              <p className="mt-8 max-w-xl text-xl leading-relaxed text-slate-300">
                Viena sistema gyventojams, kambariams ir personalui valdyti.
                Sutaupykite laiką ir sumažinkite klaidų skaičių.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={goLogin}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-4 text-base font-semibold text-white transition hover:bg-emerald-700"
                >
                  Pradėti nemokamai
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => scrollTo('features')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10"
                >
                  <PlayCircle size={19} />
                  Demo
                </button>
              </div>

              <div className="mt-10 flex items-center gap-5">
                <div className="flex -space-x-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0b1f17] bg-emerald-500 text-sm font-bold">
                    A
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0b1f17] bg-emerald-600 text-sm font-bold">
                    B
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0b1f17] bg-emerald-700 text-sm font-bold">
                    C
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0b1f17] bg-white/10 text-sm font-bold">
                    +36
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-300">
                  Naudojama socialinės globos įstaigose
                  <br />
                  Lietuvoje
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, x: 16 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white text-slate-900 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="text-2xl font-bold tracking-tight">VisaGloba</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                    2024-05-20 — 2024-05-26
                  </div>
                </div>

                <div className="flex min-h-[520px]">
                  <aside className="w-60 bg-emerald-950 p-4 text-white">
                    <div className="space-y-2">
                      {[
                        'Pagrindinis',
                        'Gyventojai',
                        'Personalas',
                        'Grafikai',
                        'Sveikatos įrašai',
                        'Dokumentai',
                        'Pranešimai',
                        'Ataskaitos',
                        'Nustatymai',
                      ].map((item, index) => (
                        <div
                          key={item}
                          className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                            index === 0
                              ? 'bg-emerald-700 text-white'
                              : 'text-emerald-50/90 hover:bg-emerald-900'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-semibold">Jonas Petraitis</div>
                      <div className="mt-1 text-xs text-emerald-100/70">Direktorius</div>
                    </div>
                  </aside>

                  <div className="flex-1 bg-slate-100 p-5">
                    <div className="mb-5 text-2xl font-bold text-slate-800">
                      Pagrindinis skydelis
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <DashboardStat
                        title="Gyventojai"
                        value="124"
                        meta="+3 nuo praėjusios savaitės"
                      />
                      <DashboardStat
                        title="Kambariai"
                        value="48"
                        meta="+1 nuo praėjusios savaitės"
                      />
                      <DashboardStat
                        title="Laisvos vietos"
                        value="7"
                        meta="-1 nuo praėjusios savaitės"
                      />
                      <DashboardStat
                        title="Užduotys"
                        value="12"
                        meta="3 vėluoja"
                        danger
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-[1.1fr_0.9fr] gap-4">
                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-700">
                          Gyventojų pasiskirstymas
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[conic-gradient(#1f7a4d_0_62%,#7dd3a5_62_86%,#d6f5e3_86_100%)]">
                            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                              <div className="text-2xl font-bold">124</div>
                              <div className="text-xs text-slate-500">iš viso</div>
                            </div>
                          </div>

                          <div className="space-y-3 text-sm">
                            <LegendItem label="Ilgalaikė globa" value="62%" color="bg-emerald-700" />
                            <LegendItem label="Trumpalaikė globa" value="24%" color="bg-emerald-400" />
                            <LegendItem label="Dienos socialinė" value="14%" color="bg-emerald-100" />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-700">
                          Artimiausi įvykiai
                        </div>

                        <div className="space-y-4">
                          <EventRow
                            title="Medikų vizitas"
                            time="Gegužės 21 d. 10:00"
                            tag="Šiandien"
                          />
                          <EventRow
                            title="Komandos susirinkimas"
                            time="Gegužės 22 d. 09:00"
                            tag="Rytoj"
                          />
                          <EventRow
                            title="Gaisrinės patikra"
                            time="Gegužės 24 d. 13:00"
                            tag="Penktadienį"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[1.1fr_0.9fr] gap-4">
                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-700">
                          Užduotys
                        </div>

                        <div className="space-y-4">
                          <TaskRow
                            title="Atnaujinti gyventojo sveikatos planą"
                            date="Iki 2024-05-21"
                            status="Vėluoja"
                            statusClass="bg-rose-100 text-rose-600"
                          />
                          <TaskRow
                            title="Patvirtinti vaistų likučius"
                            date="Iki 2024-05-22"
                            status="Laukiama"
                            statusClass="bg-amber-100 text-amber-600"
                          />
                          <TaskRow
                            title="Paruošti mėnesio ataskaitą"
                            date="Iki 2024-05-25"
                            status="Atlikta"
                            statusClass="bg-emerald-100 text-emerald-600"
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-700">
                          Greitos nuorodos
                        </div>

                        <div className="space-y-3">
                          <QuickLink label="Naujas gyventojas" />
                          <QuickLink label="Naujas dokumentas" />
                          <QuickLink label="Sukurti pranešimą" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-white py-10 text-slate-900">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-center text-sm text-slate-500">
              Pasitiki daugiau nei 50 globos įstaigų
            </p>

            <div className="mt-8 grid grid-cols-2 gap-6 text-center text-sm font-medium text-slate-500 md:grid-cols-5">
              <div>
                <div className="text-lg font-semibold text-slate-700">Vilties Namai</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Globos centras
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-700">Ramių Senatvė</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Slaugos namai
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-700">Tėviškės Namai</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Globos institucija
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-700">Gerumo Krantas</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Slaugos centras
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-700">Saulės Spindulys</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  Dienos centras
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-white py-24 text-slate-900">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-center text-4xl font-bold tracking-tight">
              Viskas, ko reikia <span className="text-emerald-600">efektyviam valdymui</span>
            </h2>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Users size={24} />}
                title="Gyventojų valdymas"
                desc="Visa informacija apie gyventojus, jų poreikius ir planus vienoje sistemoje."
              />
              <FeatureCard
                icon={<CalendarDays size={24} />}
                title="Grafikai ir pamainos"
                desc="Lengvas pamainų planavimas, darbo laiko apskaita ir aiškūs pranešimai personalui."
              />
              <FeatureCard
                icon={<FileText size={24} />}
                title="Dokumentų valdymas"
                desc="Centralizuoti dokumentai, versijų kontrolė ir saugus saugojimas vienoje vietoje."
              />
              <FeatureCard
                icon={<HeartPulse size={24} />}
                title="Sveikatos priežiūra"
                desc="Vaistų paskyrimai, sveikatos įrašai ir istorija lengvai pasiekiami darbuotojams."
              />
              <FeatureCard
                icon={<BarChart3 size={24} />}
                title="Ataskaitos ir analizė"
                desc="Realiu laiku matykite svarbius rodiklius ir priimkite duomenimis grįstus sprendimus."
              />
              <FeatureCard
                icon={<ShieldCheck size={24} />}
                title="Saugumas ir atitikimas"
                desc="Duomenų prieigos kontrolė, rolės ir BDAR reikalavimus atitinkantis saugumas."
              />
            </div>
          </div>
        </section>

        <section className="bg-white pb-24 text-slate-900">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-[28px] bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] md:flex md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/15 p-3">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="text-xl font-semibold">Saugumas ir atitikimas</div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-emerald-50/85">
                  VisaGloba atitinka BDAR reikalavimus ir užtikrina aukštą duomenų
                  saugumo lygį su rolėmis paremtu valdymu.
                </p>
              </div>

              <div className="mt-6 md:mt-0">
                <div className="text-4xl font-black">100%</div>
                <div className="mt-1 text-sm text-emerald-100/80">Duomenų saugumas</div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-slate-50 py-24 text-slate-900">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-center text-4xl font-bold tracking-tight">Paprasta kainodara</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-500">
              Rinkitės planą pagal įstaigos dydį ir reikalingus modulius.
            </p>

            <div className="mt-14 grid gap-8 lg:grid-cols-3">
              <PricingCard
                title="Basic"
                price="€49"
                description="Mažesnėms įstaigoms, kurioms reikia pagrindinių funkcijų."
                features={[
                  'Gyventojų valdymas',
                  'Kambariai',
                  'Pagrindinis dashboard',
                  'Bazinis palaikymas',
                ]}
                onClick={goLogin}
              />
              <PricingCard
                title="Pro"
                price="€99"
                description="Pilnam kasdieniam darbui su komanda ir užduotimis."
                features={[
                  'Viskas iš Basic',
                  'Užduotys ir grafikai',
                  'Darbuotojų valdymas',
                  'Detalesnės ataskaitos',
                ]}
                highlighted
                onClick={goLogin}
              />
              <PricingCard
                title="Premium"
                price="€169"
                description="Įstaigoms, kurioms reikia pažangios kontrolės ir papildomų modulių."
                features={[
                  'Viskas iš Pro',
                  'Sveikatos įrašai',
                  'Incidentai',
                  'Sandėlio modulis',
                ]}
                onClick={goLogin}
              />
            </div>
          </div>
        </section>

        <section id="contact" className="bg-white py-24 text-slate-900">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-10 rounded-[28px] border border-slate-200 bg-slate-50 p-8 shadow-sm md:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">Pasikalbėkime</h2>
                <p className="mt-4 text-slate-500">
                  Jei nori pristatymo, demo arba pasiūlymo pagal tavo įstaigos poreikius,
                  susisiek su mumis.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                      <Mail size={18} />
                    </div>
                    <span>info@visagloba.lt</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                      <Phone size={18} />
                    </div>
                    <span>+370 600 00000</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold">Pradėkite jau šiandien</div>
                <p className="mt-2 text-sm text-slate-500">
                  Prisijunkite ir pradėkite testuoti sistemą savo komandoje.
                </p>

                <button
                  type="button"
                  onClick={goLogin}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Pradėti nemokamai
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#0b1f17] py-20 text-white">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-4xl font-black tracking-tight">
              Pradėkite naudoti jau šiandien
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Mažiau chaoso. Mažiau klaidų. Daugiau kontrolės visoje įstaigoje.
            </p>

            <button
              type="button"
              onClick={goLogin}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-4 text-base font-semibold text-white transition hover:bg-emerald-700"
            >
              Pradėti nemokamai
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>
    </>
  )
}

function DashboardStat({
  title,
  value,
  meta,
  danger = false,
}: {
  title: string
  value: string
  meta: string
  danger?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-4xl font-bold leading-none text-slate-900">{value}</div>
      <div className={`mt-3 text-xs ${danger ? 'text-rose-500' : 'text-slate-400'}`}>
        {meta}
      </div>
    </div>
  )
}

function LegendItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-slate-600">{label}</span>
      </div>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  )
}

function EventRow({
  title,
  time,
  tag,
}: {
  title: string
  time: string
  tag: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{time}</div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        {tag}
      </span>
    </div>
  )
}

function TaskRow({
  title,
  date,
  status,
  statusClass,
}: {
  title: string
  date: string
  status: string
  statusClass: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{date}</div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
        {status}
      </span>
    </div>
  )
}

function QuickLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <span>{label}</span>
      <ArrowRight size={15} />
    </button>
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
    <div className="rounded-[24px] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </div>
      <div className="text-xl font-semibold text-slate-900">{title}</div>
      <p className="mt-3 text-sm leading-7 text-slate-500">{desc}</p>
    </div>
  )
}

function PricingCard({
  title,
  price,
  description,
  features,
  highlighted = false,
  onClick,
}: {
  title: string
  price: string
  description: string
  features: string[]
  highlighted?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`rounded-[28px] border p-8 shadow-sm ${
        highlighted
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-5xl font-black">{price}</span>
        <span className={`mb-1 text-sm ${highlighted ? 'text-emerald-50/80' : 'text-slate-500'}`}>
          / mėn.
        </span>
      </div>

      <p className={`mt-4 text-sm leading-6 ${highlighted ? 'text-emerald-50/85' : 'text-slate-500'}`}>
        {description}
      </p>

      <div className="mt-8 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <div
              className={`rounded-full p-1 ${
                highlighted ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Check size={14} />
            </div>
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
          highlighted
            ? 'bg-white text-emerald-700 hover:bg-emerald-50'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        Pradėti
        <ArrowRight size={16} />
      </button>
    </div>
  )
}