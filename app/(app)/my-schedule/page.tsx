"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ScheduleRow = {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  employee_id?: string | null;
  assigned_user_id?: string | null;
  staff_user_id?: string | null;
  organization_member_id?: string | null;
  member_id?: string | null;
  shift_date?: string | null;
  date?: string | null;
  work_date?: string | null;
  schedule_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  shift_type?: string | null;
  status?: string | null;
  is_published?: boolean | null;
  notes?: string | null;
  note?: string | null;
  location?: string | null;
  department?: string | null;
  position?: string | null;
};

type MembershipRow = {
  id?: string | null;
  organization_id?: string | null;
  position?: string | null;
  department?: string | null;
};

function getScheduleDate(shift: ScheduleRow) {
  return shift.shift_date || shift.date || shift.work_date || shift.schedule_date || "";
}

function getScheduleStart(shift: ScheduleRow) {
  return shift.start_time || shift.shift_start || shift.starts_at || "";
}

function getScheduleEnd(shift: ScheduleRow) {
  return shift.end_time || shift.shift_end || shift.ends_at || "";
}

function isPublished(shift: ScheduleRow) {
  const status = String(shift.status || "").toLowerCase();
  return shift.is_published === true || status === "published" || status === "paskelbta" || status === "approved";
}

function dateObject(value?: string | null) {
  if (!value) return null;
  const clean = value.slice(0, 10);
  const date = new Date(`${clean}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = dateObject(value);
  if (!date) return value?.slice(0, 10) || "Data nenurodyta";
  return new Intl.DateTimeFormat("lt-LT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function shortDate(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

function weekday(value?: string | null) {
  const date = dateObject(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).replace(".", "");
}

function cleanTime(value?: string | null) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function minutesFromTime(value?: string | null) {
  const time = cleanTime(value);
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function durationHours(shift: ScheduleRow) {
  const start = minutesFromTime(getScheduleStart(shift));
  const end = minutesFromTime(getScheduleEnd(shift));
  if (start === null || end === null) return null;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  if (cleanTime(getScheduleEnd(shift)) === "23:59") diff += 1;
  const breakMinutes = /P30|pertrauka 30/i.test(String(shift.notes || shift.note || "")) ? 30 : 0;
  return Math.max(0, diff - breakMinutes) / 60;
}

function technicalNoteHidden(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/\s*·?\s*split_parent=\d{4}-\d{2}-\d{2}/g, "")
    .replace(/split_parent=\d{4}-\d{2}-\d{2}/g, "")
    .trim();
}

function isContinuation(shift: ScheduleRow) {
  return /tęsinys|tesinys|split_parent=/i.test(String(shift.notes || shift.note || "")) && cleanTime(getScheduleStart(shift)) === "00:00";
}

function shiftLabel(shift: ScheduleRow) {
  const note = String(shift.notes || shift.note || "").toLowerCase();
  const type = String(shift.shift_type || "").toLowerCase();
  const start = cleanTime(getScheduleStart(shift));
  const end = cleanTime(getScheduleEnd(shift));

  if (note.includes("paros") && start !== "00:00") return "Paros pamaina";
  if (note.includes("paros") && start === "00:00") return "Paros pamainos tęsinys";
  if (start === end && start !== "--:--") return "Paros pamaina";
  if (type === "day" || type === "work") return "Dieninė pamaina";
  if (type === "night") return "Naktinė pamaina";
  if (type === "off") return "Poilsis";
  if (type === "sick") return "Liga";
  if (type === "reserved") return "Rezervacija";
  if (type === "short_leave") return "Trumpas išvykimas";
  if (["a", "m", "t", "na", "vacation"].includes(type)) return "Atostogos / neatvykimas";
  return "Pamaina";
}

function shiftTone(shift: ScheduleRow) {
  const label = shiftLabel(shift).toLowerCase();
  const type = String(shift.shift_type || "").toLowerCase();
  if (label.includes("paros") || type === "night") return "border-indigo-100 bg-indigo-50 text-indigo-950";
  if (type === "off") return "border-slate-200 bg-slate-50 text-slate-700";
  if (type === "sick") return "border-rose-100 bg-rose-50 text-rose-900";
  if (type === "reserved") return "border-violet-100 bg-violet-50 text-violet-900";
  if (["a", "m", "t", "na", "vacation"].includes(type)) return "border-amber-100 bg-amber-50 text-amber-900";
  return "border-emerald-100 bg-emerald-50 text-emerald-950";
}

function timeText(shift: ScheduleRow) {
  const start = cleanTime(getScheduleStart(shift));
  const end = cleanTime(getScheduleEnd(shift));
  if (end === "23:59") return `${start}–24:00`;
  return `${start}–${end}`;
}

export default function MySchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [membership, setMembership] = useState<MembershipRow | null>(null);

  useEffect(() => {
    void loadSchedule();
  }, []);

  async function loadSchedule(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membershipData } = await supabase
        .from("organization_members")
        .select("id, organization_id, position, department")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const currentMembership = (membershipData || null) as MembershipRow | null;
      setMembership(currentMembership);

      const candidates: Array<{ column: string; value: string }> = [
        { column: "user_id", value: user.id },
        { column: "assigned_user_id", value: user.id },
        { column: "staff_user_id", value: user.id },
        { column: "employee_id", value: user.id },
      ];

      if (currentMembership?.id) {
        candidates.push({ column: "organization_member_id", value: currentMembership.id });
        candidates.push({ column: "member_id", value: currentMembership.id });
        candidates.push({ column: "employee_id", value: currentMembership.id });
      }

      let found: ScheduleRow[] = [];

      for (const candidate of candidates) {
        let query = supabase
          .from("employee_schedules")
          .select("*")
          .eq(candidate.column, candidate.value)
          .limit(220);

        if (currentMembership?.organization_id) {
          query = query.eq("organization_id", currentMembership.organization_id);
        }

        const { data, error } = await query;

        if (error) {
          console.warn(`[my-schedule] skipped ${candidate.column}:`, error.message);
          continue;
        }

        const rows = ((data || []) as ScheduleRow[])
          .filter(isPublished)
          .sort((a, b) => `${getScheduleDate(a)} ${getScheduleStart(a)}`.localeCompare(`${getScheduleDate(b)} ${getScheduleStart(b)}`));

        if (rows.length) {
          found = rows;
          break;
        }
      }

      setSchedule(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko įkelti grafiko.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(() => {
    return schedule.filter((item) => {
      const date = getScheduleDate(item).slice(0, 10);
      return !date || date >= todayIso;
    });
  }, [schedule, todayIso]);

  const past = useMemo(() => {
    return schedule
      .filter((item) => {
        const date = getScheduleDate(item).slice(0, 10);
        return date && date < todayIso;
      })
      .slice(-8)
      .reverse();
  }, [schedule, todayIso]);

  const nextShift = upcoming[0] || null;

  return (
    <main className="min-h-screen bg-[#ffffff] px-4 pb-24 pt-4 text-[#10251f] sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-7xl space-y-5 lg:space-y-7">
        <section className="overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white shadow-[0_16px_45px_rgba(16,37,31,0.14)]">
          <div className="flex flex-col gap-6 bg-[#486b5d] p-7 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5">
              <button
                type="button"
                onClick={() => router.push("/employee-dashboard")}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#e8f7ef] text-[#486b5d] transition hover:bg-white"
                aria-label="Grįžti"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-100/80">
                  Mano grafikas
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                  Artimiausios pamainos
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadSchedule(true)}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[18px] bg-[#e8f7ef] px-5 text-sm font-black text-[#486b5d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="Atnaujinti grafiką"
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atnaujinti
            </button>
          </div>

          <div className="grid gap-3 bg-[#f7fcf9] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <ScheduleSummaryCard title="Būsimų" value={upcoming.length} desc="pamainų" tone="emerald" />
            <ScheduleSummaryCard title="Istorija" value={past.length} desc="įrašų" tone="slate" />
            <ScheduleSummaryCard
              title="Kita pamaina"
              value={nextShift ? shortDate(getScheduleDate(nextShift)) : "—"}
              desc={nextShift ? timeText(nextShift) : "nesuplanuota"}
              tone="amber"
            />
            <ScheduleSummaryCard
              title="Pareigos"
              value={membership?.position || "Darbuotojas"}
              desc={membership?.department || "paskelbtas grafikas"}
              tone="slate"
            />
          </div>
        </section>

        {error ? (
          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold text-amber-900">{error}</section>
        ) : null}

        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Paskelbta</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight lg:text-3xl">Pamainos</h2>
              <p className="mt-1 font-semibold text-slate-500">
                {membership?.department ? `${membership.department} · ` : ""}
                {membership?.position || "Darbuotojas"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">{upcoming.length} būsimų</div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
              </div>
            ) : upcoming.length ? (
              <>
                <div className="hidden overflow-hidden rounded-3xl border border-slate-200 lg:block">
                  <table className="w-full border-collapse bg-white text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Data</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Diena</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Laikas</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tipas</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Valandos</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pastaba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((shift) => (
                        <DesktopShiftRow key={shift.id} shift={shift} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 lg:hidden">
                  {upcoming.map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} />
                  ))}
                </div>
              </>
            ) : (
              <EmptySchedule />
            )}
          </div>
        </section>

        {!loading && past.length ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Istorija</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Praėjusios pamainos</h2>
                <p className="mt-1 font-semibold text-slate-500">Rodoma tuo pačiu formatu kaip būsimos pamainos.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">{past.length} įrašų</div>
            </div>

            <div className="mt-6">
              <div className="hidden overflow-hidden rounded-3xl border border-slate-200 lg:block">
                <table className="w-full border-collapse bg-white text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Data</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Diena</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Laikas</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tipas</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Valandos</th>
                      <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pastaba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((shift) => (
                      <DesktopShiftRow key={shift.id} shift={shift} muted />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {past.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} muted />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}


function ScheduleSummaryCard({
  title,
  value,
  desc,
  tone,
}: {
  title: string;
  value: string | number;
  desc: string;
  tone: "emerald" | "amber" | "slate";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone];

  return (
    <article className="flex min-h-[112px] items-center gap-4 rounded-[22px] border border-[#dbe6e0] bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${toneClass}`}>
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#526174]">{title}</p>
        <p className="mt-1 truncate text-2xl font-black tracking-[-0.04em] text-[#10251f]">{value}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-[#526174]">{desc}</p>
      </div>
    </article>
  );
}

function DesktopShiftRow({ shift, muted = false }: { shift: ScheduleRow; muted?: boolean }) {
  const date = getScheduleDate(shift);
  const hours = durationHours(shift);
  const cleanNote = technicalNoteHidden(shift.notes || shift.note || "");

  return (
    <tr className={muted ? "border-t border-slate-100 bg-slate-50/60" : "border-t border-slate-100"}>
      <td className="px-5 py-4 text-base font-black text-slate-950">{shortDate(date)}</td>
      <td className="px-5 py-4 text-sm font-extrabold capitalize text-slate-600">{weekday(date)}</td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-800">
          <Clock className="h-4 w-4" />
          {timeText(shift)}
        </span>
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${shiftTone(shift)}`}>{shiftLabel(shift)}</span>
      </td>
      <td className="px-5 py-4 text-sm font-black text-slate-700">{hours === null ? "—" : `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} val.`}</td>
      <td className="max-w-md px-5 py-4 text-sm font-semibold text-slate-500">{cleanNote || (isContinuation(shift) ? "Tęsinys iš ankstesnės dienos" : "—")}</td>
    </tr>
  );
}

function ShiftCard({ shift, muted = false }: { shift: ScheduleRow; muted?: boolean }) {
  const date = getScheduleDate(shift);
  const hours = durationHours(shift);
  const cleanNote = technicalNoteHidden(shift.notes || shift.note || "");

  return (
    <article className={`rounded-[22px] border bg-white p-4 shadow-sm ${muted ? "border-slate-200" : "border-[#dbe6e0]"}`}>
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-base font-black text-[#10251f]">{shortDate(date)}</p>
          <p className="mt-1 text-sm font-extrabold capitalize text-[#526174]">{weekday(date)}</p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm font-black text-slate-800">
            <Clock className="h-4 w-4" />
            {timeText(shift)}
          </span>
          <span className={`inline-flex rounded-full border px-3 py-2 text-sm font-black ${shiftTone(shift)}`}>
            {shiftLabel(shift)}
          </span>
          {hours !== null ? (
            <span className="rounded-full bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">
              {hours.toFixed(hours % 1 === 0 ? 0 : 1)} val.
            </span>
          ) : null}
        </div>

        <p className="min-w-0 text-sm font-semibold text-slate-500 sm:text-right">
          {cleanNote || (isContinuation(shift) ? "Tęsinys iš ankstesnės dienos" : "—")}
        </p>
      </div>
    </article>
  );
}

function EmptySchedule() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
        <CalendarX className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight">Paskelbtų pamainų nėra</h3>
      <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
        Kai administratorius paskelbs grafiką, pamainos automatiškai atsiras čia.
      </p>
    </div>
  );
}


