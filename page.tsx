'use client'

import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  FileText,
  HeartPulse,
  BarChart3,
  ShieldCheck,
  Users,
  PlayCircle,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Produktas', href: '#produktas' },
  { label: 'Funkcijos', href: '#funkcijos' },
  { label: 'Kainos', href: '#kainos' },
  { label: 'Kontaktai', href: '#kontaktai' },
]

const FEATURES = [
  {
    icon: Users,
    title: 'Gyventojų valdymas',
    description:
      'Visa informacija apie gyventojus vienoje vietoje – be Excel ir pasimetusių failų.',
  },
  {
    icon: CalendarDays,
    title: 'Grafikai ir pamainos',
    description:
      'Lengvas pamainų planavimas, darbo laiko apskaita ir aiškūs pranešimai personalui.',
  },
  {
    icon: FileText,
    title: 'Dokumentai',
    description:
      'Centralizuotas dokumentų valdymas su saugiu saugojimu ir versijų kontrole.',
  },
  {
    icon: HeartPulse,
    title: 'Sveikatos priežiūra',
    description:
      'Vaistų paskyrimai, sveikatos įrašai ir istorija vienoje sistemoje.',
  },
  {
    icon: BarChart3,
    title: 'Ataskaitos',
    description:
      'Realiu laiku matykite svarbiausius rodiklius ir priimkite geresnius sprendimus.',
  },
]

const BTN_PRIMARY =
  'bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2'
const BTN_SECONDARY =
  'border border-white/20 px-6 py-3 rounded-xl font-semibold text-white hover:bg-white/5 transition flex items-center gap-2'

export default function LandingPage() {
  return (
    <main className="bg-[#0b1f17] text-white min-h-screen">

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-lg">VisaGloba</div>

          <nav className="hidden md:flex gap-6 text-sm text-slate-300">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href} className="hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button className="text-sm text-slate-300 hover:text-white">
              Prisijungti
            </button>
            <button className={BTN_PRIMARY}>
              Pradėti nemokamai <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-24 min-h-screen flex items-center relative overflow-hidden">

        {/* BACKGROUND */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1f17] via-[#0f2e23] to-[#07140f]" />

          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1586105251261-72a756497a11?q=80&w=2000&auto=format&fit=crop')",
            }}
          />

          <div className="absolute left-[10%] top-[20%] w-[400px] h-[400px] bg-emerald-600 opacity-20 blur-[140px]" />
        </div>

        {/* CONTENT */}
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

          {/* TEXT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 text-sm text-emerald-300 font-semibold">
              Sistema globos įstaigoms
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-tight">
              Mažiau klaidų.
              <br />
              Mažiau chaoso.
              <br />
              <span className="text-emerald-400">Daugiau kontrolės.</span>
            </h1>

            <p className="mt-6 text-lg text-slate-300 max-w-xl">
              Viena sistema gyventojams, kambariams ir personalui valdyti.
              Sutaupykite laiką ir sumažinkite klaidų skaičių.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button className={BTN_PRIMARY}>
                Pradėti nemokamai <ArrowRight size={16} />
              </button>

              <button className={BTN_SECONDARY}>
                <PlayCircle size={18} /> Žiūrėti demo
              </button>
            </div>
          </motion.div>

          {/* MOCKUP */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl"
          >
            <div className="grid gap-4">
              <Stat title="Gyventojai" value="124" sub="+3" />
              <Stat title="Laisvos vietos" value="7" sub="Aktyvu" />
              <Stat title="Užduotys" value="12" sub="3 vėluoja" danger />
            </div>
          </motion.div>

        </div>
      </section>

      {/* TRUST */}
      <section className="bg-white text-slate-900 py-12 text-center">
        <p className="text-sm text-slate-500 mb-6">
          Pasitiki daugiau nei 50 globos įstaigų
        </p>

        <div className="flex flex-wrap justify-center gap-10 text-sm text-slate-500">
          <span>Vilties Namai</span>
          <span>Ramių Senatvė</span>
          <span>Tėviškės Namai</span>
          <span>Gerumo Krantas</span>
          <span>Saulės Spindulys</span>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funkcijos" className="bg-slate-50 text-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-6">

          <h2 className="text-3xl font-bold text-center mb-12">
            Viskas, ko reikia <span className="text-emerald-600">efektyviam valdymui</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border bg-white hover:shadow-md transition"
              >
                <f.icon className="text-emerald-600 mb-4" />
                <div className="font-semibold mb-2">{f.title}</div>
                <p className="text-sm text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECURITY */}
      <section className="bg-[#0b1f17] py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck />
                <span className="font-semibold">Saugumas ir atitikimas</span>
              </div>
              <p className="text-sm text-emerald-100">
                Atitinka BDAR reikalavimus ir užtikrina aukščiausią duomenų saugumą.
              </p>
            </div>

            <div className="text-3xl font-bold">100%</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white text-slate-900 py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">
          Pradėkite naudoti jau šiandien
        </h2>

        <button className={BTN_PRIMARY}>
          Pradėti nemokamai <ArrowRight size={16} />
        </button>
      </section>

    </main>
  )
}

function Stat({
  title,
  value,
  sub,
  danger,
}: {
  title: string
  value: string
  sub: string
  danger?: boolean
}) {
  return (
    <div className="p-4 border rounded-xl flex justify-between">
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
      <div className={danger ? 'text-red-500 text-sm' : 'text-emerald-600 text-sm'}>
        {sub}
      </div>
    </div>
  )
}