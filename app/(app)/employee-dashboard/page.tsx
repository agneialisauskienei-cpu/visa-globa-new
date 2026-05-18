"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeAlert,
  Bell,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Info,
  UserRound,
  X,
} from "lucide-react";

type ViewKey = "profile" | "schedule" | "tasks" | "notifications" | "trainings" | "documents";

type Toast = {
  title: string;
  message: string;
};

export default function EmployeeDashboardPage() {
  const [activeView, setActiveView] = useState<ViewKey>("profile");
  const [modal, setModal] = useState<ViewKey | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [contactForm, setContactForm] = useState({
    phone: "+370 600 00000",
    email: "agne.almantaitiene@example.com",
    address: "Nenurodyta",
  });

  const [documentForm, setDocumentForm] = useState({
    healthCertificateUntil: "",
    licenseUntil: "",
    licenseNumber: "",
  });

  const [documentsPendingApproval, setDocumentsPendingApproval] = useState(false);
  const [contactPendingApproval, setContactPendingApproval] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const openSection = (view: ViewKey) => {
    setActiveView(view);
    setModal(view);
  };

  const showToast = (title: string, message: string) => {
    setToast({ title, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  const submitDocuments = () => {
    setDocumentsPendingApproval(true);
    setModal(null);
    setActiveView("documents");
    showToast(
      "Pateikta administratoriui",
      "Dokumentų pakeitimai laukia administratoriaus patvirtinimo."
    );
  };

  const submitContacts = () => {
    setContactPendingApproval(true);
    setModal(null);
    setActiveView("profile");
    showToast(
      "Kontaktai pateikti",
      "Kontaktų pakeitimai laukia administratoriaus patvirtinimo."
    );
  };

  const markNotificationsRead = () => {
    setNotificationsRead(true);
    showToast("Pranešimai atnaujinti", "Visi pranešimai pažymti kaip perskaityti.");
  };

  const documentProgress = useMemo(() => {
    const total = 3;
    const filled = [
      documentForm.healthCertificateUntil,
      documentForm.licenseUntil,
      documentForm.licenseNumber,
    ].filter(Boolean).length;

    return Math.round((filled / total) * 100);
  }, [documentForm]);

  const notificationCount = notificationsRead ? "0" : "2";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-3 py-4 text-slate-950 sm:px-5 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 sm:h-16 sm:w-16 sm:rounded-3xl">
                <UserRound className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>

              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Darbuotojo paskyra
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                  Sveiki, Agn Almantaitien
                </h1>
                <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
                  Tavo pamainos, užduotys, mokymai, dokumentai ir pranešimai vienoje vietoje.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:max-w-sm sm:rounded-3xl sm:p-5 lg:min-w-[260px]">
              <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                  Pareigos
                </span>
                <strong className="text-slate-950">Darbuotojas</strong>
              </div>
              <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                  Skyrius
                </span>
                <strong className="text-slate-950"></strong>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:gap-5">
          <StatCard
            icon={<GraduationCap className="h-6 w-6" />}
            title="Mokymai"
            value="1"
            meta="2 val."
            tone="emerald"
            active={activeView === "trainings"}
            onClick={() => openSection("trainings")}
          />
          <StatCard
            icon={<BadgeAlert className="h-6 w-6" />}
            title="Baigiasi"
            value="0"
            meta="mokymų"
            tone="amber"
            active={activeView === "trainings"}
            onClick={() => openSection("trainings")}
          />
          <StatCard
            icon={<ClipboardList className="h-6 w-6" />}
            title="Užduotys"
            value="0"
            meta="atviros"
            tone="blue"
            active={activeView === "tasks"}
            onClick={() => openSection("tasks")}
          />
          <StatCard
            icon={<Bell className="h-6 w-6" />}
            title="Pranešimai"
            value={notificationCount}
            meta="naujų"
            tone="rose"
            active={activeView === "notifications"}
            onClick={() => openSection("notifications")}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2 xl:gap-6">
          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <h2 className="text-2xl font-black tracking-tight">Greiti veiksmai</h2>
              <p className="mt-1 font-semibold text-slate-500">
                Dažniausiai naudojami darbuotojo veiksmai.
              </p>

              <div className="mt-5 grid flex-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
                <ActionCard
                  title="Mano profilis"
                  desc="Peržiūrti ir redaguoti kontaktus"
                  active={activeView === "profile"}
                  onClick={() => openSection("profile")}
                />
                <ActionCard
                  title="Mano grafikas"
                  desc="Pamainos ir atostogos"
                  active={activeView === "schedule"}
                  onClick={() => openSection("schedule")}
                />
                <ActionCard
                  title="Mano užduotys"
                  desc="Atviros ir suplanuotos"
                  active={activeView === "tasks"}
                  onClick={() => openSection("tasks")}
                />
                <ActionCard
                  title="Pranešimai"
                  desc="Sistemos naujienos"
                  active={activeView === "notifications"}
                  onClick={() => openSection("notifications")}
                />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                    Mokymai
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Mano mokymai
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Tavo mokymų galiojimas ir sukauptos valandos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openSection("trainings")}
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                >
                  Visa informacija
                </button>
              </div>

              <div className="mt-5 flex-1 space-y-3">
                <button
                  type="button"
                  onClick={() => openSection("trainings")}
                  className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-100"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="font-black text-slate-900">Darbų sauga</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        Baigta: 2026-04-27 · Galioja iki: 2027-04-26
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
                      Galioja
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openSection("trainings")}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-slate-200 hover:bg-slate-100"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="font-black text-slate-900">Privalomi mokymai</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        Nra papildomų mokymų, kuriuos reikia atlikti dabar.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-600">
                      0 laukia
                    </span>
                  </div>
                </button>
              </div>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-amber-600">
                    Dokumentai
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Dokumentų būsena
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Pažymos, licencijos ir privalomi dokumentai.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openSection("documents")}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition hover:bg-amber-100 active:scale-[0.98]"
                  aria-label="Atidaryti dokumentus"
                >
                  <FileCheck2 className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-5 grid flex-1 gap-3 sm:mt-6">
                <DocumentRow
                  title="Sveikatos pažyma"
                  desc={documentForm.healthCertificateUntil ? `Galioja iki: ${documentForm.healthCertificateUntil}` : "Galiojimas nenurodytas"}
                  badge={documentForm.healthCertificateUntil ? "Užpildyta" : "Nenurodyta"}
                  tone={documentForm.healthCertificateUntil ? "emerald" : "slate"}
                  onClick={() => openSection("documents")}
                />
                <DocumentRow
                  title="Profesin licencija"
                  desc={documentForm.licenseUntil ? `Galioja iki: ${documentForm.licenseUntil}` : "Galiojimas nenurodytas"}
                  badge={documentForm.licenseUntil ? "Užpildyta" : "Nenurodyta"}
                  tone={documentForm.licenseUntil ? "emerald" : "slate"}
                  onClick={() => openSection("documents")}
                />
                <DocumentRow
                  title="Licencijos numeris"
                  desc={documentForm.licenseNumber ? documentForm.licenseNumber : "Trūksta įrašo profilyje"}
                  badge={documentForm.licenseNumber ? "Užpildyta" : "Trūksta"}
                  tone={documentForm.licenseNumber ? "emerald" : "amber"}
                  onClick={() => openSection("documents")}
                />
              </div>

              {documentsPendingApproval && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  Pakeitimai pateikti administratoriui patvirtinti.
                </div>
              )}
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
                    Grafikas
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Artimiausios pamainos
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Tavo suplanuotos pamainos per artimiausias 14 dienų.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openSection("schedule")}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
                  aria-label="Atidaryti grafik"
                >
                  <CalendarDays className="h-6 w-6" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => openSection("schedule")}
                className="mt-6 flex flex-1 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <CalendarX className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <p className="mt-4 font-black text-slate-700">
                    Artimiausių pamainų nerasta
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Kai grafikas bus suplanuotas, pamainos atsiras čia.
                  </p>
                </div>
              </button>
            </Card>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Asmenin statistika
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Mano rodikliai
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Greita asmenins būsenos ir darbo informacijos apžvalga.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openSection("profile")}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
            >
              Peržiūrti profilį
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-6">
            <ChartCard
              title="Mokymai"
              value="100%"
              progress={100}
              color="#10b981"
              desc="Atliktų privalomų mokymų dalis."
              onClick={() => openSection("trainings")}
            />
            <ChartCard
              title="Dokumentai"
              value={`${documentProgress}%`}
              progress={documentProgress}
              color="#f59e0b"
              desc="Užpildytų dokumentų būsena."
              onClick={() => openSection("documents")}
            />
            <ChartCard
              title="Užduotys"
              value="0"
              progress={0}
              color="#3b82f6"
              desc="Atviros užduotys šiuo metu."
              onClick={() => openSection("tasks")}
            />
            <ChartCard
              title="Pranešimai"
              value={notificationCount}
              progress={notificationsRead ? 0 : 50}
              color="#f43f5e"
              desc="Neskaityti sistemos pranešimai."
              onClick={() => openSection("notifications")}
            />
          </div>
        </section>
      </div>

      {modal === "profile" && (
        <Modal title="Mano profilis" desc="Kontaktin informacija ir asmeniniai duomenys." onClose={() => setModal(null)}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              submitContacts();
            }}
          >
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Telefonas">
                  <input
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="input"
                    placeholder="+370..."
                  />
                </Field>
                <Field label="El. paštas">
                  <input
                    value={contactForm.email}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="input"
                    type="email"
                    placeholder="vardas@example.com"
                  />
                </Field>
                <Field label="Adresas">
                  <input
                    value={contactForm.address}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="input md:col-span-2"
                    placeholder="Adresas"
                  />
                </Field>
              </div>
            </div>

            <InfoBox text="Kontaktų pakeitimai bus pateikti administratoriui patvirtinti." />

            {contactPendingApproval && (
              <InfoBox text="Kontaktų pakeitimai jau pateikti administratoriui patvirtinti." />
            )}

            <ModalFooter onCancel={() => setModal(null)} submitText="Pateikti patvirtinimui" />
          </form>
        </Modal>
      )}

      {modal === "documents" && (
        <Modal title="Dokumentai" desc="Atnaujinkite pažymų ir licencijų informacij. Pakeitimai bus pateikti administratoriui." onClose={() => setModal(null)}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              submitDocuments();
            }}
          >
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Licencijos numeris" full>
                  <input
                    value={documentForm.licenseNumber}
                    onChange={(e) => setDocumentForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                    className="input"
                    placeholder="Pvz., 2412"
                  />
                </Field>
                <Field label="Licencija galioja iki">
                  <input
                    value={documentForm.licenseUntil}
                    onChange={(e) => setDocumentForm((prev) => ({ ...prev, licenseUntil: e.target.value }))}
                    className="input"
                    type="date"
                  />
                </Field>
                <Field label="Med. pažyma galioja iki">
                  <input
                    value={documentForm.healthCertificateUntil}
                    onChange={(e) => setDocumentForm((prev) => ({ ...prev, healthCertificateUntil: e.target.value }))}
                    className="input"
                    type="date"
                  />
                </Field>
              </div>
            </div>

            <InfoBox text="Įrašas bus pateiktas administratoriui patvirtinti, kad dokumentai buvo matyti." />

            <ModalFooter onCancel={() => setModal(null)} submitText="Pateikti patvirtinimui" />
          </form>
        </Modal>
      )}

      {modal === "schedule" && (
        <Modal title="Mano grafikas" desc="Pamainos ir atostogų informacija." onClose={() => setModal(null)}>
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <CalendarX className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-4 text-lg font-black">Artimiausių pamainų nerasta</p>
            <p className="mt-1 font-semibold text-slate-500">
              Kai grafikas bus suplanuotas, pamainos atsiras čia.
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setModal(null)} className="btn-primary" type="button">
              Supratau
            </button>
          </div>
        </Modal>
      )}

      {modal === "tasks" && (
        <Modal title="Mano užduotys" desc="Atviros ir suplanuotos užduotys." onClose={() => setModal(null)}>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="font-black text-slate-800">Šiuo metu atvirų užduočių nra.</p>
            <p className="mt-1 font-semibold text-slate-500">
              Naujos užduotys atsiras šiame lange.
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setModal(null)} className="btn-primary" type="button">
              Uždaryti
            </button>
          </div>
        </Modal>
      )}

      {modal === "trainings" && (
        <Modal title="Mano mokymai" desc="Mokymų galiojimas ir sukauptos valandos." onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-lg font-black text-slate-900">Darbų sauga</p>
                  <p className="mt-1 font-semibold text-slate-600">
                    Baigta: 2026-04-27 · Galioja iki: 2027-04-26 · 2 val.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
                  Galioja
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-black text-slate-900">Privalomi mokymai</p>
              <p className="mt-1 font-semibold text-slate-600">
                Papildomų privalomų mokymų dabar nra.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setModal(null)} className="btn-primary" type="button">
              Uždaryti
            </button>
          </div>
        </Modal>
      )}

      {modal === "notifications" && (
        <Modal title="Pranešimai" desc="Sistemos naujienos ir svarbūs pranešimai." onClose={() => setModal(null)}>
          <div className="space-y-3">
            {notificationsRead ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-3 font-black">Naujų pranešimų nra</p>
              </div>
            ) : (
              <>
                <NotificationItem title="Dokumentai" desc="Patikrinkite dokumentų galiojimo informacij." />
                <NotificationItem title="Profilis" desc="Kontaktų pakeitimai turi būti pateikti administratoriui." />
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="btn-secondary" type="button">
              Uždaryti
            </button>
            <button onClick={markNotificationsRead} className="btn-primary" type="button">
              Pažymti kaip skaitytus
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed inset-x-3 bottom-4 z-50 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm sm:rounded-3xl sm:p-5">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-black text-slate-950">{toast.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #dbe3ef;
          background: white;
          padding: 0.9rem 1rem;
          font-weight: 800;
          color: #0f172a;
          outline: none;
        }

        .input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
        }

        .btn-primary {
          border-radius: 1rem;
          background: #020617;
          padding: 0.85rem 1.1rem;
          font-weight: 900;
          color: white;
          transition: transform 0.15s ease, background 0.15s ease;
          width: 100%;
        }

        @media (min-width: 640px) {
          .btn-primary,
          .btn-secondary {
            width: auto;
          }
        }

        .btn-primary:hover {
          background: #1e293b;
        }

        .btn-primary:active {
          transform: scale(0.98);
        }

        .btn-secondary {
          border-radius: 1rem;
          border: 1px solid #dbe3ef;
          background: white;
          padding: 0.85rem 1.1rem;
          font-weight: 900;
          color: #334155;
          transition: transform 0.15s ease, background 0.15s ease;
          width: 100%;
        }

        .btn-secondary:hover {
          background: #f8fafc;
        }

        .btn-secondary:active {
          transform: scale(0.98);
        }
      `}</style>
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
    <article
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 ${className}`}
    >
      {children}
    </article>
  );
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
  tone: "emerald" | "amber" | "blue" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md active:scale-[0.99] sm:rounded-3xl sm:p-6 ${
        active ? "border-emerald-200 ring-4 ring-emerald-50" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${toneClass}`}>
          {icon}
        </div>

        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-black sm:text-4xl">
            {value} <span className={`text-sm font-bold ${textClass}`}>{meta}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-24 items-center justify-between gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        active
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50"
      }`}
    >
      <span>
        <b>{title}</b>
        <br />
        <small className="font-semibold text-slate-500">{desc}</small>
      </span>

      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function DocumentRow({
  title,
  desc,
  badge,
  tone,
  onClick,
}: {
  title: string;
  desc: string;
  badge: string;
  tone: "slate" | "amber" | "emerald";
  onClick: () => void;
}) {
  const rowClass = {
    amber: "border border-amber-100 bg-amber-50 hover:bg-amber-100",
    emerald: "border border-emerald-100 bg-emerald-50 hover:bg-emerald-100",
    slate: "border border-transparent bg-slate-50 hover:border-slate-200 hover:bg-slate-100",
  }[tone];

  const badgeClass = {
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    slate: "text-slate-600",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start justify-between gap-3 rounded-2xl p-4 text-left transition active:scale-[0.99] sm:flex-row sm:items-center ${rowClass}`}
    >
      <div>
        <p className="font-black text-slate-800">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
      </div>

      <span className={`rounded-full bg-white px-3 py-1 text-sm font-black ${badgeClass}`}>
        {badge}
      </span>
    </button>
  );
}

function ChartCard({
  title,
  value,
  progress,
  color,
  desc,
  onClick,
}: {
  title: string;
  value: string;
  progress: number;
  color: string;
  desc: string;
  onClick: () => void;
}) {
  const circumference = 301;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.99] sm:rounded-[32px] sm:p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">{value}</h3>
        </div>

        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center sm:h-24 sm:w-24">
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
    </button>
  );
}

function Modal({
  title,
  desc,
  children,
  onClose,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.5rem] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:gap-6 sm:p-7">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-2 font-semibold text-slate-500">{desc}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-[0.98] sm:h-14 sm:w-14"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        </div>

        <div className="p-4 sm:p-7">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
      <Info className="h-5 w-5 shrink-0" />
      <p className="font-extrabold">{text}</p>
    </div>
  );
}

function ModalFooter({
  onCancel,
  submitText,
}: {
  onCancel: () => void;
  submitText: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} className="btn-secondary">
        Atšaukti
      </button>
      <button type="submit" className="btn-primary">
        {submitText}
      </button>
    </div>
  );
}

function NotificationItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="font-black text-slate-900">{title}</p>
      <p className="mt-1 font-semibold text-slate-500">{desc}</p>
    </div>
  );
}

