"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronRight,
  Edit3,
  FileCheck2,
  FilePlus2,
  FileText,
  FileWarning,
  Home,
  Info,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { getCurrentMembership } from "@/lib/current-membership";
import { getReadableError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
};

type NotificationCountRow = {
  id: string;
  is_read: boolean | null;
};

type TrainingRow = {
  id: string;
  title: string | null;
  hours: number | null;
  provider: string | null;
  completed_at: string | null;
  expires_at: string | null;
  certificate_no?: string | null;
  verified?: boolean | null;
  verified_by?: string | null;
};

type VacationRow = {
  id: string;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  requested_days: number | null;
  note: string | null;
  created_at?: string | null;
};

type TrainingForm = {
  title: string;
  provider: string;
  hours: string;
  completed_at: string;
  expires_at: string;
  certificate_no: string;
};

type VacationForm = {
  type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  note: string;
};

type ProfileForm = {
  first_name: string;
  last_name: string;
  phone: string;
};

type DocumentForm = {
  professional_license_number: string;
  professional_license_valid_until: string;
  occupational_health_valid_until: string;
};

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function today() {
  return toDateInput(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000) + 1);
}

function hoursBetween(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 0;

  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  return Math.max(0, Math.round(((end - start) / 60) * 10) / 10);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Nepavyko perskaityti failo."));
    reader.readAsDataURL(file);
  });
}

function formatFullName(profile: ProfileRow | null) {
  const combined = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (combined) return combined;
  if (profile?.full_name?.trim()) return profile.full_name.trim();

  return profile?.email || "Darbuotojas";
}

function initials(profile: ProfileRow | null) {
  const name = formatFullName(profile);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();

  return name.slice(0, 2).toUpperCase();
}

function roleLabel(role?: string | null) {
  const value = String(role || "")
    .toLowerCase()
    .trim();

  if (value === "super_admin" || value === "owner")
    return "Super administratorius";
  if (value === "admin") return "Administratorius";
  if (value === "employee") return "Darbuotojas";

  return role || "Rolė nepriskirta";
}

function positionLabel(position?: string | null) {
  const raw = String(position || "").trim();
  const value = raw.toLowerCase();

  if (!value) return "Pareigos nepriskirtos";
  if (value === "individualios_prieziuros_darbuotojas") {
    return "Individualios priežiūros darbuotojas";
  }
  if (value === "socialinis_darbuotojas") return "Socialinis darbuotojas";
  if (value === "slaugytojas" || value === "slaugytoja") return "Slaugytoja";
  if (value === "slaugytojo_padejejas" || value === "slaugytojo_padėjėjas") {
    return "Slaugytojo padėjėjas";
  }
  if (value === "ukvedys" || value === "ūkvedys") return "Ūkvedys";

  return raw.replaceAll("_", " ");
}

function departmentLabel(department?: string | null) {
  const raw = String(department || "").trim();
  const value = raw.toLowerCase();

  if (!value) return "Padalinys nepriskirtas";
  if (value === "administracija" || value === "admin") return "Administracija";
  if (value === "slauga") return "Slauga";
  if (value === "socialinis" || value === "socialine_sritis")
    return "Socialinė sritis";
  if (value === "ukis" || value === "ūkis" || value === "maintenance")
    return "Ūkis";
  if (
    value === "maitinimas" ||
    value === "kitchen" ||
    value === "maisto_blokas"
  ) {
    return "Maitinimo paslaugos";
  }

  return raw.replaceAll("_", " ");
}

function vacationTypeLabel(type?: string | null) {
  const value = String(type || "annual").toLowerCase();

  if (value === "sick") return "Liga";
  if (value === "unpaid") return "Nemokamos atostogos";
  if (value === "mother_day") return "Mamadienis";
  if (value === "father_day") return "Tėvadienis";
  if (value === "temporary_leave") return "Trumpas išvykimas";

  return "Kasmetinės atostogos";
}

function vacationStatusLabel(status?: string | null) {
  const value = String(status || "submitted").toLowerCase();

  if (["approved", "confirmed", "patvirtinta"].includes(value))
    return "Patvirtinta";
  if (
    ["rejected", "cancelled", "canceled", "atmesta", "atšaukta"].includes(value)
  ) {
    return "Atmesta";
  }

  return "Laukia";
}

export default function MyProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [membership, setMembership] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [trainings, setTrainings] = useState<TrainingRow[]>([]);
  const [vacations, setVacations] = useState<VacationRow[]>([]);

  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentsRef = useRef<HTMLElement | null>(null);

  const [trainingForm, setTrainingForm] = useState<TrainingForm>({
    title: "",
    provider: "",
    hours: "1",
    completed_at: today(),
    expires_at: "",
    certificate_no: "",
  });

  const [vacationForm, setVacationForm] = useState<VacationForm>({
    type: "annual",
    start_date: today(),
    end_date: toDateInput(addDays(new Date(), 4)),
    start_time: "09:00",
    end_time: "11:00",
    note: "",
  });

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    phone: "",
  });

  const [documentForm, setDocumentForm] = useState<DocumentForm>({
    professional_license_number: "",
    professional_license_valid_until: "",
    occupational_health_valid_until: "",
  });

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(ROUTES.login);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, email, first_name, last_name, full_name, avatar_url, phone, role",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      const currentProfile = (profileData as ProfileRow | null) || null;
      setProfile(currentProfile);
      setProfileForm({
        first_name: currentProfile?.first_name || "",
        last_name: currentProfile?.last_name || "",
        phone: currentProfile?.phone || "",
      });

      const currentMembership = await getCurrentMembership(user.id);
      setMembership(currentMembership);
      setDocumentForm({
        professional_license_number:
          currentMembership?.professional_license_number || "",
        professional_license_valid_until:
          currentMembership?.professional_license_valid_until || "",
        occupational_health_valid_until:
          currentMembership?.occupational_health_valid_until || "",
      });

      if (
        currentMembership?.role === "owner" ||
        currentMembership?.role === "admin"
      ) {
        router.replace(ROUTES.adminDashboard);
        return;
      }

      if (currentMembership?.organization_id) {
        const { data: organization, error: organizationError } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", currentMembership.organization_id)
          .maybeSingle();

        if (!organizationError) {
          setOrganizationName(String((organization as any)?.name || ""));
        }

        const [notificationsResult, trainingsResult, vacationsResult] =
          await Promise.all([
            supabase
              .from("notifications")
              .select("id, is_read")
              .eq("user_id", user.id)
              .eq("is_read", false),
            supabase
              .from("personnel_trainings")
              .select(
                "id, title, hours, provider, completed_at, expires_at, certificate_no, verified, verified_by",
              )
              .eq("organization_id", currentMembership.organization_id)
              .eq("employee_id", user.id)
              .order("completed_at", { ascending: false }),
            supabase
              .from("personnel_vacation_requests")
              .select(
                "id, type, start_date, end_date, status, requested_days, note, created_at",
              )
              .eq("organization_id", currentMembership.organization_id)
              .eq("employee_id", user.id)
              .order("created_at", { ascending: false }),
          ]);

        if (notificationsResult.error) throw notificationsResult.error;
        if (trainingsResult.error) throw trainingsResult.error;
        if (vacationsResult.error) throw vacationsResult.error;

        setNotificationsCount(
          ((notificationsResult.data as NotificationCountRow[]) || []).length,
        );
        setTrainings((trainingsResult.data as TrainingRow[]) || []);
        setVacations((vacationsResult.data as VacationRow[]) || []);
      }
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [router]);

  const pendingVacations = useMemo(
    () =>
      vacations.filter((item) => vacationStatusLabel(item.status) === "Laukia"),
    [vacations],
  );

  const approvedVacationDays = useMemo(
    () =>
      vacations
        .filter((item) => vacationStatusLabel(item.status) === "Patvirtinta")
        .reduce((sum, item) => sum + Number(item.requested_days || 0), 0),
    [vacations],
  );

  const missingProfileCount = useMemo(() => {
    let count = 0;

    if (!profile?.phone) count += 1;
    if (!membership?.position) count += 1;
    if (!membership?.department) count += 1;
    if (!membership?.professional_license_number) count += 1;

    return count;
  }, [profile, membership]);

  async function submitTraining() {
    if (!profile?.id || !membership?.organization_id) {
      setMessage("Nepavyko nustatyti darbuotojo arba įstaigos.");
      return;
    }

    const cleanTitle = trainingForm.title.trim();
    const hours = Number(trainingForm.hours || 0);

    if (!cleanTitle) {
      setMessage("Įveskite mokymų pavadinimą.");
      return;
    }

    if (Number.isNaN(hours) || hours <= 0) {
      setMessage("Valandų skaičius turi būti didesnis už 0.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("personnel_trainings").insert({
        organization_id: membership.organization_id,
        employee_id: profile.id,
        title: cleanTitle,
        hours,
        provider: trainingForm.provider.trim() || null,
        completed_at: trainingForm.completed_at || today(),
        expires_at: trainingForm.expires_at || null,
        certificate_no: trainingForm.certificate_no.trim() || null,
        mandatory: false,
        verified: false,
        verified_by: null,
      });

      if (error) throw error;

      setShowTrainingModal(false);
      setTrainingForm({
        title: "",
        provider: "",
        hours: "1",
        completed_at: today(),
        expires_at: "",
        certificate_no: "",
      });
      setMessage("Mokymai pateikti administratoriaus patvirtinimui.");
      await loadData();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitVacation() {
    if (!profile?.id || !membership?.organization_id) {
      setMessage("Nepavyko nustatyti darbuotojo arba įstaigos.");
      return;
    }

    if (!vacationForm.start_date || !vacationForm.end_date) {
      setMessage("Pasirinkite pradžios ir pabaigos datą.");
      return;
    }

    if (vacationForm.end_date < vacationForm.start_date) {
      setMessage("Pabaigos data negali būti ankstesnė už pradžią.");
      return;
    }

    const isTemporaryLeave = vacationForm.type === "temporary_leave";
    const requestedHours = hoursBetween(
      vacationForm.start_time,
      vacationForm.end_time,
    );

    if (isTemporaryLeave && requestedHours <= 0) {
      setMessage("Trumpam išvykimui pasirinkite teisingas valandas.");
      return;
    }

    const requestedDays = isTemporaryLeave
      ? Math.round((requestedHours / 8) * 100) / 100
      : daysBetween(vacationForm.start_date, vacationForm.end_date);

    const noteWithTime = isTemporaryLeave
      ? [
          vacationForm.note.trim(),
          `Išvykimo laikas: ${vacationForm.start_time}–${vacationForm.end_time} (${requestedHours} val.)`,
        ]
          .filter(Boolean)
          .join("\n")
      : vacationForm.note.trim() || null;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("personnel_vacation_requests")
        .insert({
          organization_id: membership.organization_id,
          employee_id: profile.id,
          type: vacationForm.type,
          start_date: vacationForm.start_date,
          end_date: isTemporaryLeave
            ? vacationForm.start_date
            : vacationForm.end_date,
          status: "submitted",
          requested_days: requestedDays,
          note: noteWithTime,
        });

      if (error) throw error;

      setShowVacationModal(false);
      setVacationForm({
        type: "annual",
        start_date: today(),
        end_date: toDateInput(addDays(new Date(), 4)),
        start_time: "09:00",
        end_time: "11:00",
        note: "",
      });
      setMessage("Prašymas pateiktas administratoriaus peržiūrai.");
      await loadData();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateProfileInfo() {
    if (!profile?.id) {
      setMessage("Nepavyko nustatyti vartotojo.");
      return;
    }

    const firstName = profileForm.first_name.trim();
    const lastName = profileForm.last_name.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || null,
          phone: profileForm.phone.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setShowProfileModal(false);
      setMessage("Profilio informacija atnaujinta.");
      await loadData();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateDocumentsInfo() {
    if (!profile?.id) {
      setMessage("Nepavyko nustatyti vartotojo.");
      return;
    }

    const cleanDocuments = {
      professional_license_number:
        documentForm.professional_license_number.trim() || null,
      professional_license_valid_until:
        documentForm.professional_license_valid_until || null,
      occupational_health_valid_until:
        documentForm.occupational_health_valid_until || null,
    };

    if (
      !cleanDocuments.professional_license_number &&
      !cleanDocuments.professional_license_valid_until &&
      !cleanDocuments.occupational_health_valid_until
    ) {
      setMessage("Įveskite bent vieną dokumentų lauką.");
      return;
    }

    setSaving(true);
    setMessage("");

    const submittedAt = new Date().toISOString();
    const reviewFields = {
      documents_review_status: "submitted",
      documents_verified: false,
      documents_admin_seen: false,
      documents_submitted_at: submittedAt,
    };

    try {
      let saved = false;
      let lastError: unknown = null;

      // Optimistiškai atnaujiname UI, kad mygtukas aiškiai sureaguotų iš karto.
      setMembership((prev: any) =>
        prev
          ? {
              ...prev,
              ...cleanDocuments,
              ...reviewFields,
            }
          : prev,
      );

      // Bandome dažniausiai naudojamus narystės lentelių pavadinimus.
      // Kai kuriose bazėse statuso laukų gali nebūti, todėl pirmiausia saugome privalomus dokumentų laukus.
      const membershipTables = [
        "organization_members",
        "organization_memberships",
        "memberships",
      ];

      for (const tableName of membershipTables) {
        const baseUpdate = supabase.from(tableName).update(cleanDocuments);

        const updateAttempts = [];
        if (membership?.id) updateAttempts.push(baseUpdate.eq("id", membership.id));
        if (membership?.organization_id) {
          updateAttempts.push(
            supabase
              .from(tableName)
              .update(cleanDocuments)
              .eq("organization_id", membership.organization_id)
              .eq("user_id", profile.id),
          );
          updateAttempts.push(
            supabase
              .from(tableName)
              .update(cleanDocuments)
              .eq("organization_id", membership.organization_id)
              .eq("employee_id", profile.id),
          );
        }

        for (const attempt of updateAttempts) {
          const { error } = await attempt;
          if (!error) {
            saved = true;

            // Statuso laukai neprivalomi — jei jų nėra, klaidą ignoruojame.
            if (membership?.id) {
              await supabase
                .from(tableName)
                .update(reviewFields)
                .eq("id", membership.id);
            }
            break;
          }
          lastError = error;
        }

        if (saved) break;
      }

      // Papildomai sukuriame admin peržiūros įrašą, jeigu tokia lentelė projekte yra.
      const requestPayload = {
        organization_id: membership?.organization_id || null,
        employee_id: profile.id,
        user_id: profile.id,
        membership_id: membership?.id || null,
        ...cleanDocuments,
        status: "pending",
        review_status: "submitted",
        verified: false,
        admin_seen: false,
        submitted_at: submittedAt,
        created_at: submittedAt,
      };

      for (const tableName of [
        "personnel_document_requests",
        "personnel_document_updates",
        "employee_document_requests",
        "employee_document_submissions",
      ]) {
        const { error } = await supabase.from(tableName).insert(requestPayload);
        if (!error) break;
      }

      if (!saved) throw lastError || new Error("Nepavyko išsaugoti dokumentų.");

      setShowDocumentsModal(false);
      setMessage(
        "Dokumentai pateikti administratoriui patvirtinti, kad buvo matyti.",
      );
      await loadData();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!profile?.id) {
      setMessage("Nepavyko nustatyti vartotojo.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Pasirinkite nuotraukos failą.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Nuotrauka negali būti didesnė nei 5 MB.");
      return;
    }

    setUploadingPhoto(true);
    setMessage("Keliama profilio nuotrauka...");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.id}/avatar-${Date.now()}.${extension}`;
      const bucketCandidates = [
        "avatars",
        "profile-photos",
        "profile_photos",
        "public",
      ];
      let avatarUrl = "";

      for (const bucketName of bucketCandidates) {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
          avatarUrl = data.publicUrl;
          break;
        }
      }

      // Fallback: jei Supabase Storage bucket nėra sukonfigūruotas, vis tiek leidžiame vartotojui
      // matyti pasirinktą nuotrauką ir išsaugome ją avatar_url lauke kaip data URL.
      if (!avatarUrl) {
        avatarUrl = await readFileAsDataUrl(file);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
      setMessage("Profilio nuotrauka atnaujinta.");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setUploadingPhoto(false);
    }
  }

  function openDocuments() {
    setShowDocumentsModal(true);
    documentsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function showComingSoon(title: string) {
    setMessage(`${title}: šis veiksmas dar neturi atskiro nustatymų puslapio.`);
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white px-6 py-4 text-lg font-black text-slate-600 shadow-sm">
          Kraunama...
        </div>
      </div>
    );
  }

  const fullName = formatFullName(profile);
  const photo = profile?.avatar_url;

  return (
    <main className="min-h-screen bg-slate-50 p-6 pb-24 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 text-xl font-black text-emerald-700 transition hover:border-emerald-400 hover:ring-4 hover:ring-emerald-100 disabled:opacity-60"
                  aria-label="Įkelti profilio nuotrauką"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt="Profilio nuotrauka"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(profile)
                  )}
                  <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-950/60 to-transparent pb-1 text-white opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                    <Camera className="h-4 w-4" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-xs font-black text-emerald-700 underline-offset-4 hover:underline disabled:opacity-60"
                >
                  {uploadingPhoto ? "Keliama..." : "Įkelti foto"}
                </button>
              </div>

              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Darbuotojo apžvalga
                </p>
                <h1 className="mt-2 break-words text-4xl font-black tracking-tight">
                  {fullName}
                </h1>
                <p className="mt-2 text-lg font-semibold text-slate-500">
                  {organizationName || "Mano profilis"} ·{" "}
                  {roleLabel(membership?.role || profile?.role)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadData()}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-extrabold text-emerald-700 transition hover:bg-emerald-100"
              >
                <RefreshCw className="h-4 w-4" />
                Atnaujinti
              </button>
              <button
                type="button"
                onClick={() => router.push(ROUTES.employeeDashboard)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Home className="h-4 w-4" />Į skydelį
              </button>
            </div>
          </div>
        </section>

        <input
          id="profile-photo-upload"
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void uploadProfilePhoto(event)}
        />

        {message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 font-bold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<UserRound />}
            title="Pareigos"
            value={positionLabel(membership?.position)}
            meta={departmentLabel(membership?.department)}
          />
          <StatCard
            icon={<CalendarCheck />}
            title="Atostogos"
            value={`${pendingVacations.length}`}
            meta="laukia"
          />
          <StatCard
            icon={<FileCheck2 />}
            title="Mokymai"
            value={`${trainings.length}`}
            meta="įrašai"
          />
          <StatCard
            icon={<AlertTriangle />}
            title="Profilis"
            value={`${missingProfileCount}`}
            meta="trūksta"
            warning={missingProfileCount > 0}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <h2 className="text-2xl font-black tracking-tight">
                Greiti veiksmai
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Dažniausiai naudojami profilio veiksmai.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ActionCard
                  icon={<FilePlus2 />}
                  title="Pridėti mokymus"
                  desc="Pavadinimas, data, valandos"
                  onClick={() => setShowTrainingModal(true)}
                />
                <ActionCard
                  icon={<CalendarPlus />}
                  title="Pateikti prašymą"
                  desc="Atostogos arba išvykimas"
                  onClick={() => setShowVacationModal(true)}
                />
                <ActionCard
                  icon={<Edit3 />}
                  title="Redaguoti informaciją"
                  desc="Kontaktai ir profilis"
                  onClick={() => setShowProfileModal(true)}
                />
                <ActionCard
                  icon={<FileText />}
                  title="Dokumentai"
                  desc="Pažymos ir licencijos"
                  onClick={openDocuments}
                />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">
                    Mano mokymai
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Įveskite išklausytus mokymus, o administratorius juos
                    patvirtins.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrainingModal(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Pridėti
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {trainings.slice(0, 3).map((item) => (
                  <TrainingCard key={item.id} item={item} />
                ))}

                {trainings.length === 0 ? (
                  <EmptyState text="Mokymų įrašų dar nėra." />
                ) : null}
              </div>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="min-h-[286px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                    Šiandien
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Darbuotojo santrauka
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Kontaktai, dokumentai ir atostogų būsena vienoje vietoje.
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Info className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  title="El. paštas"
                  value={profile?.email || "—"}
                  muted
                />
                <SummaryCard
                  title="Telefonas"
                  value={profile?.phone || "Trūksta"}
                  muted={!profile?.phone}
                />
                <SummaryCard
                  title="Patvirtinta"
                  value={`${approvedVacationDays} d.`}
                />
                <SummaryCard
                  title="Pranešimai"
                  value={`${notificationsCount} nauji`}
                  muted={notificationsCount === 0}
                />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-amber-600">
                    Prioritetai
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Reikia dėmesio
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Profilio, dokumentų ir prašymų klausimai.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {!membership?.professional_license_number ? (
                  <PriorityCard
                    title="Trūksta licencijos"
                    desc="Įkelkite arba įveskite numerį."
                    color="red"
                    badge="Skubu"
                  />
                ) : null}
                {!profile?.phone ? (
                  <PriorityCard
                    title="Neužpildytas telefonas"
                    desc="Papildykite kontaktinę informaciją."
                    color="amber"
                    badge="Svarbu"
                  />
                ) : null}
                {!membership?.position ? (
                  <PriorityCard
                    title="Pareigos nepriskirtos"
                    desc="Reikalingas administratoriaus veiksmas."
                    color="blue"
                    badge="Sekti"
                  />
                ) : null}
                {pendingVacations.length > 0 ? (
                  <PriorityCard
                    title="Atostogų prašymai"
                    desc={`${pendingVacations.length} praš. laukia sprendimo.`}
                    color="emerald"
                    badge="Laukia"
                  />
                ) : null}
                {missingProfileCount === 0 && pendingVacations.length === 0 ? (
                  <div className="rounded-2xl bg-emerald-50 p-4 font-black text-emerald-700">
                    Viskas tvarkoje.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <Card>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex w-28 shrink-0 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 text-3xl font-black text-slate-950 shadow-sm transition hover:ring-4 hover:ring-emerald-100 disabled:opacity-60"
                  aria-label="Įkelti profilio nuotrauką"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt="Profilio nuotrauka"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(profile)
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" />
                  {uploadingPhoto ? "Keliama..." : photo ? "Keisti foto" : "Įkelti foto"}
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Mano informacija
                </p>
                <h2 className="mt-1 break-words text-2xl font-black tracking-tight">
                  {fullName}
                </h2>

                <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-100">
                  <ProfileInfoRow
                    icon={<Mail />}
                    label="El. paštas"
                    value={profile?.email || "—"}
                  />
                  <ProfileInfoRow
                    icon={<UserRound />}
                    label="Pareigos"
                    value={positionLabel(membership?.position)}
                  />
                  <ProfileInfoRow
                    icon={<ShieldCheck />}
                    label="Padalinys"
                    value={departmentLabel(membership?.department)}
                  />
                  <ProfileInfoRow
                    icon={<Phone />}
                    label="Telefonas"
                    value={profile?.phone || "Trūksta"}
                    warning={!profile?.phone}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Redaguoti kontaktus
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Atostogos
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Mano prašymai
                </h2>
                <p className="mt-1 font-semibold text-slate-500">
                  Atostogos, liga, mamadienis, tėvadienis arba trumpas
                  išvykimas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVacationModal(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
              >
                <CalendarPlus className="h-4 w-4" />
                Pateikti
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <InfoStat
                title="Likutis"
                value="14 d."
                hint="Preliminarus"
                tone="green"
              />
              <InfoStat
                title="Laukia"
                value={String(pendingVacations.length)}
                hint="Sprendimo"
                tone="amber"
              />
              <InfoStat
                title="Patvirtinta"
                value={`${approvedVacationDays} d.`}
                hint="Šiemet"
                tone="green"
              />
            </div>

            <div className="mt-5 space-y-3">
              {vacations.slice(0, 2).map((item) => (
                <VacationCard key={item.id} item={item} />
              ))}

              {vacations.length === 0 ? (
                <EmptyState text="Atostogų prašymų dar nėra." />
              ) : null}
            </div>
          </Card>
        </section>

        <section
          ref={documentsRef}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Dokumentai
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Dokumentų būsena
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Medicininės pažymos, licencijos ir kiti galiojimai.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDocumentsModal(true)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            >
              Redaguoti
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DocumentItem
              title="Med. pažyma"
              badge={formatDate(
                membership?.occupational_health_valid_until || null,
              )}
              tone="slate"
            />
            <DocumentItem
              title="Licencijos numeris"
              badge={membership?.professional_license_number || "Trūksta"}
              tone={membership?.professional_license_number ? "slate" : "amber"}
            />
            <DocumentItem
              title="Licencija galioja iki"
              badge={formatDate(
                membership?.professional_license_valid_until || null,
              )}
              tone="slate"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
            <div>
              <p className="text-lg font-black tracking-tight">
                Paskyros nustatymai
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Tvarkykite savo paskyros saugumą ir pranešimų nustatymus.
              </p>
            </div>

            <SettingsButton
              title="Slaptažodis"
              desc="Siųsti keitimo nuorodą"
              onClick={() => showComingSoon("Slaptažodis")}
            />
            <SettingsButton
              title="Dvigubas autentifikavimas"
              desc="Saugumo nustatymai"
              onClick={() => showComingSoon("Dvigubas autentifikavimas")}
            />
            <SettingsButton
              title="Pranešimų nustatymai"
              desc="El. paštu ir sistemoje"
              onClick={() => showComingSoon("Pranešimų nustatymai")}
            />
          </div>
        </section>
      </div>

      <style jsx global>{`
        .form-input {
          min-height: 3.25rem;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          font-weight: 800;
          color: rgb(15 23 42);
          outline: none;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }
        .form-input::placeholder {
          color: rgb(148 163 184);
          font-weight: 700;
        }
        .form-input:focus {
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 4px rgb(16 185 129 / 0.12);
        }
      `}</style>

      <MobileBottomNav />

      {showProfileModal ? (
        <Modal
          title="Redaguoti informaciją"
          subtitle="Atnaujinkite kontaktus ir pagrindinę profilio informaciją."
          onClose={() => setShowProfileModal(false)}
        >
          <div className="space-y-5">
            <ModalSection
              title="Profilio informacija"
              icon={<UserRound className="h-4 w-4" />}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-2xl font-black text-slate-900 transition hover:ring-4 hover:ring-emerald-100 disabled:opacity-60"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt="Profilio nuotrauka"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(profile)
                  )}
                  <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-xl bg-slate-950/75 px-2 py-1 text-xs font-black text-white">
                    <Camera className="h-4 w-4" />
                    Įkelti
                  </span>
                </button>
                <div>
                  <p className="font-black text-slate-900">
                    Profilio nuotrauka
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    JPG, PNG arba WEBP iki 5 MB.
                  </p>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {uploadingPhoto ? "Keliama..." : "Įkelti nuotrauką"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vardas">
                  <input
                    value={profileForm.first_name}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        first_name: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Vardas"
                  />
                </Field>
                <Field label="Pavardė">
                  <input
                    value={profileForm.last_name}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        last_name: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Pavardė"
                  />
                </Field>
              </div>

              <Field label="Telefonas">
                <input
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder="+370..."
                />
              </Field>
            </ModalSection>

            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Atšaukti
              </button>
              <button
                type="button"
                disabled={saving || uploadingPhoto}
                onClick={() => void updateProfileInfo()}
                className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saugoma..." : "Išsaugoti"}
              </button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}

      {showDocumentsModal ? (
        <Modal
          title="Dokumentai"
          subtitle="Atnaujinkite pažymų ir licencijų informaciją. Pakeitimai bus pateikti administratoriui."
          onClose={() => setShowDocumentsModal(false)}
        >
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void updateDocumentsInfo();
            }}
          >
            <ModalSection
              title="Dokumentų galiojimas"
              icon={<FileText className="h-4 w-4" />}
            >
              <Field label="Licencijos numeris">
                <input
                  value={documentForm.professional_license_number}
                  onChange={(event) =>
                    setDocumentForm((prev) => ({
                      ...prev,
                      professional_license_number: event.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder="Įveskite numerį"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Licencija galioja iki">
                  <input
                    type="date"
                    value={documentForm.professional_license_valid_until}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        professional_license_valid_until: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>

                <Field label="Med. pažyma galioja iki">
                  <input
                    type="date"
                    value={documentForm.occupational_health_valid_until}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        occupational_health_valid_until: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>
              </div>
            </ModalSection>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-900">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p>
                Įrašas bus pateiktas administratoriui patvirtinti, kad
                dokumentai buvo matyti.
              </p>
            </div>

            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowDocumentsModal(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Atšaukti
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void updateDocumentsInfo()}
                className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Siunčiama..." : "Pateikti patvirtinimui"}
              </button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}

      {showTrainingModal ? (
        <Modal
          title="Pridėti mokymus"
          subtitle="Įveskite mokymų informaciją. Įrašas bus perduotas administratoriui patvirtinti."
          onClose={() => setShowTrainingModal(false)}
        >
          <div className="space-y-5">
            <ModalSection
              title="Mokymų informacija"
              icon={<FilePlus2 className="h-4 w-4" />}
            >
              <Field label="Mokymų pavadinimas">
                <input
                  value={trainingForm.title}
                  onChange={(event) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder="Pvz., Pirmoji pagalba"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
                <Field label="Tiekėjas">
                  <input
                    value={trainingForm.provider}
                    onChange={(event) =>
                      setTrainingForm((prev) => ({
                        ...prev,
                        provider: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Mokymų tiekėjas"
                  />
                </Field>

                <Field label="Valandos">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={trainingForm.hours}
                    onChange={(event) =>
                      setTrainingForm((prev) => ({
                        ...prev,
                        hours: event.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="1"
                  />
                </Field>
              </div>
            </ModalSection>

            <ModalSection
              title="Datos ir pažymėjimas"
              icon={<CalendarCheck className="h-4 w-4" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Išklausyta">
                  <input
                    type="date"
                    value={trainingForm.completed_at}
                    onChange={(event) =>
                      setTrainingForm((prev) => ({
                        ...prev,
                        completed_at: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>

                <Field label="Galioja iki">
                  <input
                    type="date"
                    value={trainingForm.expires_at}
                    onChange={(event) =>
                      setTrainingForm((prev) => ({
                        ...prev,
                        expires_at: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>
              </div>

              <Field label="Pažymėjimo numeris" hint="Neprivaloma">
                <input
                  value={trainingForm.certificate_no}
                  onChange={(event) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      certificate_no: event.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder="Įrašykite, jei yra"
                />
              </Field>
            </ModalSection>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-900">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p>
                Įrašas bus pateiktas administratoriui patvirtinti, kad
                pažymėjimas buvo matytas.
              </p>
            </div>

            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowTrainingModal(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Atšaukti
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitTraining()}
                className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saugoma..." : "Pateikti mokymus"}
              </button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}

      {showVacationModal ? (
        <Modal
          title="Pateikti prašymą"
          onClose={() => setShowVacationModal(false)}
        >
          <div className="grid gap-4">
            <Field label="Prašymo tipas">
              <select
                value={vacationForm.type}
                onChange={(event) =>
                  setVacationForm((prev) => ({
                    ...prev,
                    type: event.target.value,
                    end_date:
                      event.target.value === "temporary_leave"
                        ? prev.start_date
                        : prev.end_date,
                  }))
                }
                className="form-input"
              >
                <option value="annual">Kasmetinės atostogos</option>
                <option value="temporary_leave">
                  Trumpas išvykimas, pvz. pas daktarą
                </option>
                <option value="unpaid">Nemokamos atostogos</option>
                <option value="sick">Liga</option>
                <option value="mother_day">Mamadienis</option>
                <option value="father_day">Tėvadienis</option>
              </select>
            </Field>

            {vacationForm.type === "temporary_leave" ? (
              <>
                <Field label="Data">
                  <input
                    type="date"
                    value={vacationForm.start_date}
                    onChange={(event) =>
                      setVacationForm((prev) => ({
                        ...prev,
                        start_date: event.target.value,
                        end_date: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nuo val.">
                    <input
                      type="time"
                      value={vacationForm.start_time}
                      onChange={(event) =>
                        setVacationForm((prev) => ({
                          ...prev,
                          start_time: event.target.value,
                        }))
                      }
                      className="form-input"
                    />
                  </Field>

                  <Field label="Iki val.">
                    <input
                      type="time"
                      value={vacationForm.end_time}
                      onChange={(event) =>
                        setVacationForm((prev) => ({
                          ...prev,
                          end_time: event.target.value,
                        }))
                      }
                      className="form-input"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nuo">
                  <input
                    type="date"
                    value={vacationForm.start_date}
                    onChange={(event) =>
                      setVacationForm((prev) => ({
                        ...prev,
                        start_date: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>

                <Field label="Iki">
                  <input
                    type="date"
                    value={vacationForm.end_date}
                    onChange={(event) =>
                      setVacationForm((prev) => ({
                        ...prev,
                        end_date: event.target.value,
                      }))
                    }
                    className="form-input"
                  />
                </Field>
              </div>
            )}

            <Field label="Komentaras">
              <textarea
                value={vacationForm.note}
                onChange={(event) =>
                  setVacationForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
                className="form-input min-h-[110px] resize-none"
                placeholder={
                  vacationForm.type === "temporary_leave"
                    ? "Pvz., vizitas pas gydytoją"
                    : "Papildoma informacija administratoriui"
                }
              />
            </Field>

            <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              Prašymas bus pateiktas administratoriui patvirtinti.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowVacationModal(false)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700"
              >
                Atšaukti
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitVacation()}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saugoma..." : "Pateikti prašymą"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
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
  warning = false,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  meta: string;
  warning?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl [&>svg]:h-6 [&>svg]:w-6 ${warning ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700"}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 truncate text-3xl font-black">
            {value}{" "}
            <span
              className={`text-sm font-bold ${warning ? "text-amber-600" : "text-emerald-700"}`}
            >
              {meta}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
    >
      <span className="flex items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <span>
          <b>{title}</b>
          <br />
          <small className="font-semibold text-slate-500">{desc}</small>
        </span>
      </span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function SummaryCard({
  title,
  value,
  muted = false,
}: {
  title: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black text-slate-800">{title}</p>
      <p
        className={`mt-1 truncate text-sm font-black ${muted ? "text-slate-600" : "text-emerald-700"}`}
      >
        {value}
      </p>
    </div>
  );
}

function PriorityCard({
  title,
  desc,
  badge,
  color,
}: {
  title: string;
  desc: string;
  badge: string;
  color: "amber" | "red" | "blue" | "emerald";
}) {
  const styles = {
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[color];

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${styles}`}
    >
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

function TrainingCard({ item }: { item: TrainingRow }) {
  const verified = Boolean(item.verified);

  return (
    <div
      className={`group rounded-2xl border p-4 transition ${verified ? "border-emerald-100 bg-emerald-50 hover:border-emerald-200" : "border-amber-100 bg-amber-50 hover:border-amber-200"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-black text-slate-900">{item.title || "Mokymai"}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {formatDate(item.completed_at || null)} · {Number(item.hours || 0)}{" "}
            val.
            {item.expires_at
              ? ` · Galioja iki ${formatDate(item.expires_at)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full bg-white px-3 py-1 text-sm font-black ${verified ? "text-emerald-700" : "text-amber-700"}`}
          >
            {verified ? "Patvirtinta" : "Laukia"}
          </span>
          <ChevronRight
            className={`h-5 w-5 opacity-0 transition group-hover:opacity-100 ${verified ? "text-emerald-700" : "text-amber-700"}`}
          />
        </div>
      </div>
    </div>
  );
}

function VacationCard({ item }: { item: VacationRow }) {
  const status = vacationStatusLabel(item.status);
  const approved = status === "Patvirtinta";
  const rejected = status === "Atmesta";

  return (
    <div
      className={`group rounded-2xl border p-4 transition ${approved ? "border-emerald-100 bg-emerald-50" : rejected ? "border-rose-100 bg-rose-50" : "border-amber-100 bg-amber-50"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-black text-slate-900">
            {vacationTypeLabel(item.type)}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {formatDate(item.start_date || null)}
            {item.type === "temporary_leave"
              ? item.note?.includes("Išvykimo laikas:")
                ? ` · ${item.note.split("Išvykimo laikas:")[1]?.trim()}`
                : ""
              : ` – ${formatDate(item.end_date || null)} · ${Number(item.requested_days || 0)} d.`}
          </p>
        </div>
        <span
          className={`rounded-full bg-white px-3 py-1 text-sm font-black ${approved ? "text-emerald-700" : rejected ? "text-rose-700" : "text-amber-700"}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function ProfileInfoRow({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5 ${warning ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600"}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-500">{label}</p>
        <p
          className={`truncate font-black ${warning ? "text-amber-700" : "text-slate-900"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoStat({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "green" | "amber";
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${tone === "green" ? "bg-emerald-50" : "bg-amber-50"}`}
    >
      <p className="text-sm font-black text-slate-600">{title}</p>
      <p
        className={`mt-1 text-2xl font-black ${tone === "green" ? "text-emerald-700" : "text-amber-700"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function DocumentItem({
  title,
  badge,
  tone,
}: {
  title: string;
  badge: string;
  tone: "slate" | "amber";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${tone === "amber" ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-slate-50"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-white ${tone === "amber" ? "text-amber-600" : "text-slate-600"}`}
        >
          {tone === "amber" ? (
            <FileWarning className="h-5 w-5" />
          ) : (
            <FileCheck2 className="h-5 w-5" />
          )}
        </div>
        <p className="font-black text-slate-900">{title}</p>
      </div>
      <span
        className={`rounded-full bg-white px-3 py-1 text-sm font-black ${tone === "amber" ? "text-amber-700" : "text-slate-600"}`}
      >
        {badge}
      </span>
    </div>
  );
}

function SettingsButton({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center font-bold text-slate-500">
      {text}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
        {hint ? (
          <span className="normal-case tracking-normal text-slate-400">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function ModalSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
          {icon}
        </span>
        {title}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
            aria-label="Uždaryti"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-96px)] overflow-y-auto bg-white px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
