'use client'

import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  Heart,
  Pill,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react'

const modules = [
  { icon: <UserRoundCheck />, title: 'Gyventojai', desc: 'Profiliai, rizikos, kambariai ir priskyrimai vienoje vietoje.' },
  { icon: <Pill />, title: 'Medicina', desc: 'Vaistų žymėjimas, priminimai ir vėlavimų kontrolė.' },
  { icon: <CalendarDays />, title: 'Grafikai', desc: 'Pamainos, neatvykimai ir komandos pakeitimai.' },
  { icon: <ClipboardCheck />, title: 'Užduotys', desc: 'Dienos darbai, atsakomybės ir atlikimo patvirtinimai.' },
  { icon: <RefreshCw />, title: 'Perdavimai', desc: 'Pamainų įrašai, peržiūros ir aiškus atsakomybės tęstinumas.' },
  { icon: <Bell />, title: 'Pranešimai', desc: 'Kritiniai įvykiai, svarbios žinutės ir greitas reagavimas.' },
  { icon: <FileBarChart />, title: 'Ataskaitos', desc: 'Vadovo apžvalgos, rodikliai ir auditinis pėdsakas.' },
  { icon: <Users />, title: 'Komanda', desc: 'Darbuotojai, prašymai, pajėgumas ir aktyvios pamainos.' },
  { icon: <ShieldCheck />, title: 'Organizacija', desc: 'Įstaigos nustatymai, rolės ir prieigos valdymas.' },
]

export default function LandingPage() {
  const router = useRouter()
  const goLogin = () => router.push('/login')

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#10251f]">
      <header className="sticky top-0 z-50 border-b border-[#dbe6e0] bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[82px] lg:px-12">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 text-xl font-black text-[#10251f] sm:text-2xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#003c2e] text-white">
              <Heart className="h-5 w-5" />
            </span>
            VisaGloba
          </button>

          <nav className="hidden items-center gap-1 rounded-[18px] border border-[#dbe6e0] bg-white p-1 md:flex">
            <button type="button" onClick={() => scrollTo('solution')} className="rounded-[14px] bg-[#486b5d] px-4 py-3 text-sm font-black text-white">
              Sprendimas
            </button>
            <button type="button" onClick={() => scrollTo('modules')} className="rounded-[14px] px-4 py-3 text-sm font-black text-[#486b5d] transition hover:bg-[#f0f6f3]">
              Moduliai
            </button>
            <button type="button" onClick={() => scrollTo('team')} className="rounded-[14px] px-4 py-3 text-sm font-black text-[#486b5d] transition hover:bg-[#f0f6f3]">
              Darbuotojams
            </button>
            <button type="button" onClick={() => scrollTo('contact')} className="rounded-[14px] px-4 py-3 text-sm font-black text-[#486b5d] transition hover:bg-[#f0f6f3]">
              Kontaktai
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={goLogin} className="hidden h-11 rounded-[12px] border border-[#c9d8d0] bg-white px-4 text-sm font-black text-[#39594c] transition hover:bg-[#f7faf8] sm:inline-flex sm:items-center">
              Prisijungti
            </button>
            <button type="button" onClick={goLogin} className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[#486b5d] px-4 text-sm font-black text-white transition hover:bg-[#39594c]">
              Pradėti
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section id="solution" className="px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="relative mx-auto min-h-[560px] max-w-[1440px] overflow-hidden rounded-[22px] border border-[#dbe6e0] bg-[#e9f1ed] shadow-[0_22px_60px_rgba(16,37,31,0.12)] lg:min-h-[600px]">
          <div
            className="absolute inset-0 bg-cover bg-[center_38%]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(0,60,46,.84) 0%, rgba(0,60,46,.62) 34%, rgba(0,60,46,.20) 62%, rgba(0,60,46,.08) 100%), linear-gradient(180deg, rgba(0,60,46,.08), rgba(0,60,46,.20)), url("https://assets.carescout.com/5760x3840/9e5d91ecad/older-adult-and-caregiver-smiling-at-each-other.jpeg/m/1600x0")',
            }}
          />

          <div className="relative z-10 flex min-h-[560px] max-w-[650px] flex-col justify-center px-6 py-10 text-left text-white sm:px-10 lg:min-h-[600px] lg:px-14">
            <div className="mb-6 inline-flex items-center gap-3 text-xl font-black sm:text-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/25 bg-white/15">
                <Heart className="h-5 w-5" />
              </span>
              VisaGloba
            </div>

            <h1 className="max-w-[640px] text-[42px] font-black leading-[1.04] tracking-normal text-white sm:text-[54px] lg:text-[62px]">
              Globos įstaigos darbas vienoje aiškioje vietoje.
            </h1>

            <p className="mt-5 max-w-[620px] text-base font-bold leading-7 text-white/90 sm:text-lg">
              Padėkite komandai matyti gyventojus, pamainas, užduotis ir
              svarbius pranešimus kiekvieną dieną.
            </p>

            <div className="mt-6 h-0.5 w-16 rounded-full bg-[#c9d8d0]" />

            <p className="mt-5 max-w-[620px] text-sm font-extrabold leading-6 text-white/90 sm:text-base">
              Gyventojų priežiūra, medicina, grafikai ir perdavimai sujungiami
              į vieną darbo centrą.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={goLogin} className="inline-flex h-12 items-center justify-center rounded-[12px] bg-white px-6 text-sm font-black text-[#486b5d] transition hover:bg-[#f0f6f3]">
                Pradėti
              </button>
              <button type="button" onClick={goLogin} className="inline-flex h-12 items-center justify-center rounded-[12px] border border-white/30 bg-white/10 px-6 text-sm font-black text-white transition hover:bg-white/15">
                Prisijungti
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 lg:px-10 lg:pb-20">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h2 className="text-[38px] font-black leading-tight tracking-normal text-[#10251f] sm:text-[50px]">
            Darbo sritys
          </h2>
          <p className="mt-4 text-base font-bold leading-7 text-[#64786f] sm:text-lg">
            Greitai atidarykite svarbiausias sistemos dalis ir matykite tik tai,
            kas aktualu šiandienos darbui.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </section>

      <section id="team" className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-10">
        <div className="rounded-[22px] border border-[#dbe6e0] bg-white p-6 shadow-[0_12px_34px_rgba(16,37,31,0.06)] sm:p-8 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#486b5d]">
              Darbuotojams
            </p>
            <h2 className="mt-3 text-[34px] font-black leading-tight tracking-normal text-[#10251f] sm:text-[44px]">
              Aiški pamaina be informacijos blaškymosi.
            </h2>
            <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-[#64786f] sm:text-lg">
              Kiekvienas darbuotojas mato savo užduotis, pranešimus, gyventojų
              informaciją ir perdavimus pagal turimas teises.
            </p>
          </div>

          <button type="button" onClick={goLogin} className="mt-6 inline-flex h-12 items-center justify-center rounded-[12px] bg-[#486b5d] px-6 text-sm font-black text-white transition hover:bg-[#39594c] lg:mt-0">
            Atidaryti sistemą
          </button>
        </div>
      </section>

      <section id="contact" className="border-t border-[#dbe6e0] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <b className="block text-lg font-black text-[#10251f]">VisaGloba</b>
            <span className="mt-1 block text-sm font-bold text-[#64786f]">
              Globos įstaigų darbo valdymo sistema
            </span>
          </div>
          <button type="button" onClick={goLogin} className="inline-flex h-11 items-center justify-center rounded-[12px] border border-[#c9d8d0] bg-white px-5 text-sm font-black text-[#39594c] transition hover:bg-[#f7faf8]">
            Prisijungti
          </button>
        </div>
      </section>
    </main>
  )
}

function ModuleCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <article className="flex min-h-[150px] flex-col items-center justify-center rounded-[16px] border border-[#dbe6e0] bg-white p-5 text-center shadow-[0_8px_22px_rgba(16,37,31,0.04)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-[#f0f6f3] text-[#486b5d] [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-black leading-tight text-[#223029]">
        {title}
      </h3>
      <p className="mt-2 max-w-[260px] text-sm font-bold leading-6 text-[#64786f]">
        {desc}
      </p>
    </article>
  )
}
