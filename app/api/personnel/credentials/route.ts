import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CredentialInput = {
  type?: string | null;
  number?: string | null;
  expires_at?: string | null;
  note?: string | null;
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Trūksta Supabase serverio aplinkos kintamųjų.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization") ||
    "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

async function getActiveMemberships(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
) {
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return { user: null, memberships: [], error: "Neprisijungęs vartotojas." };
  }

  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id, user_id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) {
    return { user, memberships: [], error: error.message };
  }

  return { user, memberships: data || [], error: "" };
}

function normalizeCredentialType(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("licenc")) return "Profesinė licencija";
  if (raw.includes("sveikat")) return "Sveikatos pažyma";
  return String(value || "Sveikatos pažyma").trim();
}

function cleanCredential(input: CredentialInput) {
  return {
    type: normalizeCredentialType(input.type),
    number: String(input.number || "").trim() || null,
    expires_at: String(input.expires_at || "").trim() || null,
    note: String(input.note || "").trim() || null,
  };
}

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Trūksta prisijungimo token." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { user, memberships, error } = await getActiveMemberships(admin, token);

    if (error || !user) {
      return NextResponse.json({ error: error || "Neprisijungęs vartotojas." }, { status: 401 });
    }

    const organizationIds = memberships
      .map((membership) => membership.organization_id)
      .filter(Boolean);

    if (!organizationIds.length) {
      return NextResponse.json({ credentials: [] });
    }

    const { data, error: credentialsError } = await admin
      .from("personnel_credentials")
      .select("id, organization_id, employee_id, type, number, expires_at, status, note, created_at")
      .eq("employee_id", user.id)
      .in("organization_id", organizationIds)
      .order("created_at", { ascending: false });

    if (credentialsError) {
      return NextResponse.json({ error: credentialsError.message }, { status: 500 });
    }

    return NextResponse.json({ credentials: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Trūksta prisijungimo token." }, { status: 401 });
    }

    const body = (await request.json()) as {
      organization_id?: string | null;
      credentials?: CredentialInput[];
    };

    const admin = createAdminClient();
    const { user, memberships, error } = await getActiveMemberships(admin, token);

    if (error || !user) {
      return NextResponse.json({ error: error || "Neprisijungęs vartotojas." }, { status: 401 });
    }

    const organizationId = String(body.organization_id || "").trim();
    const canSubmit = memberships.some(
      (membership) => membership.organization_id === organizationId,
    );

    if (!organizationId || !canSubmit) {
      return NextResponse.json({ error: "Nerasta aktyvi darbuotojo organizacija." }, { status: 403 });
    }

    const rows = (body.credentials || [])
      .map(cleanCredential)
      .filter((credential) => credential.expires_at || credential.number)
      .map((credential) => ({
        organization_id: organizationId,
        employee_id: user.id,
        type: credential.type,
        number: credential.number,
        expires_at: credential.expires_at,
        status: "pending",
        note: credential.note || "Pateikta darbuotojo patvirtinimui.",
      }));

    if (!rows.length) {
      return NextResponse.json({ error: "Nėra pateiktų dokumentų duomenų." }, { status: 400 });
    }

    const { data, error: insertError } = await admin
      .from("personnel_credentials")
      .insert(rows)
      .select("id, organization_id, employee_id, type, number, expires_at, status, note, created_at");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: managers } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["owner", "admin", "director", "hr"]);

    const notificationRows = (managers || [])
      .map((manager) => manager.user_id)
      .filter((managerId) => managerId && managerId !== user.id)
      .map((managerId) => ({
        user_id: managerId,
        title: "Darbuotojas pateikė dokumentų duomenis",
        message: "Dokumentų pakeitimai laukia peržiūros komandos dokumentų modulyje.",
        type: "documents",
        is_read: false,
      }));

    if (notificationRows.length) {
      await admin.from("notifications").insert(notificationRows);
    }

    return NextResponse.json({ credentials: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
