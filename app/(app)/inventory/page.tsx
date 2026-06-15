"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BedDouble,
  Boxes,
  CheckCircle2,
  Download,
  PackageOpen,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trash2,
  WashingMachine,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";

type TabKey =
  | "overview"
  | "stock"
  | "assigned"
  | "uniforms"
  | "laundry"
  | "movements"
  | "writeoffs";
type InventoryCategory =
  | "diapers"
  | "bedding"
  | "cleaning"
  | "medication"
  | "uniforms"
  | "other";
type StockStatus = "ok" | "low" | "empty";
type MovementType = "in" | "out" | "adjustment";

type InventoryItem = {
  id: string;
  organization_id: string;
  name: string | null;
  unit: string | null;
  quantity: number | null;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  min_quantity: number | null;
  is_active?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type InventoryLog = {
  id: string;
  organization_id: string;
  item_id: string | null;
  item_name: string | null;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  unit: string | null;
  resident_id: string | null;
  resident_code: string | null;
  employee_user_id: string | null;
  employee_full_name: string | null;
  quantity: number | null;
  type: string | null;
  notes: string | null;
  created_at: string | null;
};

type PersonOption = {
  id: string;
  label: string;
  isActive?: boolean;
};

type AddForm = {
  name: string;
  category: InventoryCategory;
  subcategory: string;
  size: string;
  unit: string;
  quantity: string;
  minQuantity: string;
};

type SingleMovementForm = {
  itemId: string;
  targetId: string;
  quantity: string;
  notes: string;
};

type LaundryForm = {
  itemId: string;
  quantity: string;
  unitMode: string;
  notes: string;
};

type CategoryMeta = {
  code: InventoryCategory;
  title: string;
  short: string;
  description: string;
  icon: ElementType;
  mode: "consumable" | "asset" | "uniform";
};

const CATEGORIES: CategoryMeta[] = [
  {
    code: "diapers",
    title: "Sauskelnės",
    short: "Sunaudojamos",
    description: "Išduodamos gyventojams ir laikomos sunaudotomis.",
    icon: PackageOpen,
    mode: "consumable",
  },
  {
    code: "bedding",
    title: "Patalynė / tekstilė",
    short: "Ciklinės",
    description: "Priskiriama, keliauja į skalbyklą, grįžta arba nurašoma.",
    icon: BedDouble,
    mode: "asset",
  },
  {
    code: "cleaning",
    title: "Valymo priemonės",
    short: "Sunaudojamos",
    description: "Papildymas ir sunaudojimas įstaigos reikmėms.",
    icon: Sparkles,
    mode: "consumable",
  },
  {
    code: "medication",
    title: "Vaistai",
    short: "Sunaudojamos",
    description: "Likučiai, papildymai ir išdavimai per medicinos procesą.",
    icon: Pill,
    mode: "consumable",
  },
  {
    code: "uniforms",
    title: "Uniformos",
    short: "Darbuotojams",
    description: "Išduodamos darbuotojams, grąžinamos arba nurašomos.",
    icon: Shirt,
    mode: "uniform",
  },
  {
    code: "other",
    title: "Kita",
    short: "Mišru",
    description: "Kitos prekės, kurias galima išduoti, priskirti ar nurašyti.",
    icon: Boxes,
    mode: "consumable",
  },
];

const SUBCATEGORY_OPTIONS: Record<
  InventoryCategory,
  Array<{ value: string; label: string }>
> = {
  diapers: [
    { value: "pants", label: "Kelnaitės" },
    { value: "tape", label: "Juostinės sauskelnės" },
    { value: "night", label: "Naktinės sauskelnės" },
    { value: "insert", label: "Įklotai" },
    { value: "underpad", label: "Paklotai" },
  ],
  bedding: [
    { value: "set", label: "Patalynės komplektas" },
    { value: "sheet", label: "Paklodė" },
    { value: "duvet_cover", label: "Antklodės užvalkalas" },
    { value: "pillowcase", label: "Pagalvės užvalkalas" },
    { value: "blanket", label: "Antklodė" },
    { value: "pillow", label: "Pagalvė" },
    { value: "towel", label: "Rankšluostis" },
  ],
  cleaning: [
    { value: "liquid", label: "Skystis" },
    { value: "spray", label: "Purškiklis" },
    { value: "powder", label: "Milteliai" },
    { value: "gel", label: "Gelis" },
    { value: "wipes", label: "Servetėlės" },
    { value: "disinfectant", label: "Dezinfekantas" },
    { value: "bags", label: "Maišeliai" },
    { value: "gloves", label: "Pirštinės" },
  ],
  medication: [
    { value: "tablet", label: "Tabletės" },
    { value: "capsule", label: "Kapsulės" },
    { value: "liquid", label: "Skystis" },
    { value: "drops", label: "Lašai" },
    { value: "ointment", label: "Tepalas" },
    { value: "injection", label: "Injekcija" },
    { value: "bandage", label: "Tvarstis" },
  ],
  uniforms: [
    { value: "shirt", label: "Marškinėliai" },
    { value: "pants", label: "Kelnės" },
    { value: "jacket", label: "Švarkas / džemperis" },
    { value: "robe", label: "Chalatas" },
    { value: "shoes", label: "Avalynė" },
    { value: "apron", label: "Prijuostė" },
  ],
  other: [
    { value: "general", label: "Bendra prekė" },
    { value: "equipment", label: "Įranga" },
    { value: "office", label: "Kanceliarinės prekės" },
    { value: "hygiene", label: "Higienos priemonės" },
  ],
};

const SIZE_OPTIONS: Partial<Record<InventoryCategory, string[]>> = {
  diapers: ["XS", "S", "M", "L", "XL", "XXL"],
  bedding: [
    "kg",
    "vnt.",
    "maišai",
    "komplektai",
    "60x120",
    "80x160",
    "90x200",
    "140x200",
    "160x200",
    "200x220",
  ],
  uniforms: [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "36",
    "38",
    "40",
    "42",
    "44",
    "46",
  ],
};

const DEFAULT_ADD_FORM: AddForm = {
  name: "",
  category: "diapers",
  subcategory: "pants",
  size: "M",
  unit: "vnt.",
  quantity: "0",
  minQuantity: "0",
};

const DEFAULT_MOVEMENT: SingleMovementForm = {
  itemId: "",
  targetId: "",
  quantity: "1",
  notes: "",
};

const DEFAULT_LAUNDRY: LaundryForm = {
  itemId: "",
  quantity: "1",
  unitMode: "kg",
  notes: "",
};

function getReadableError(error: unknown) {
  if (!error) return "Nepavyko įvykdyti veiksmo.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return (
      [e.message, e.details, e.hint, e.code].filter(Boolean).join(" · ") ||
      "Nepavyko įvykdyti veiksmo."
    );
  }
  return String(error);
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function categoryMeta(category?: string | null) {
  return (
    CATEGORIES.find((item) => item.code === category) ||
    CATEGORIES.find((item) => item.code === "other")!
  );
}

function getCategoryTitle(category?: string | null) {
  return categoryMeta(category).title;
}

function getSubcategoryLabel(
  category?: string | null,
  subcategory?: string | null,
) {
  if (!subcategory) return "—";
  const options =
    SUBCATEGORY_OPTIONS[(category || "other") as InventoryCategory] || [];
  return (
    options.find((item) => item.value === subcategory)?.label || subcategory
  );
}

function getDefaultSubcategory(category: InventoryCategory) {
  return SUBCATEGORY_OPTIONS[category]?.[0]?.value || "general";
}

function getDefaultSize(category: InventoryCategory) {
  return SIZE_OPTIONS[category]?.[0] || "";
}

function shouldShowSize(category: InventoryCategory) {
  return (
    category === "diapers" || category === "bedding" || category === "uniforms"
  );
}

function getStockStatus(
  quantity?: number | null,
  minQuantity?: number | null,
): StockStatus {
  const q = Number(quantity || 0);
  if (q <= 0) return "empty";
  if (
    minQuantity !== null &&
    minQuantity !== undefined &&
    q <= Number(minQuantity || 0)
  )
    return "low";
  return "ok";
}

function getStockLabel(status: StockStatus) {
  if (status === "empty") return "Pasibaigė";
  if (status === "low") return "Baigiasi";
  return "Tvarkoje";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("lt-LT");
}

function formatQuantity(
  quantity?: number | string | null,
  unit?: string | null,
) {
  const q = Number(quantity || 0);
  return `${Number.isInteger(q) ? q : q.toFixed(2)} ${unit || "vnt."}`;
}

function isUniformItem(item?: InventoryItem | null) {
  if (!item) return false;
  const text = normalizeText(
    [item.category, item.subcategory, item.name, item.size]
      .filter(Boolean)
      .join(" "),
  );
  return (
    item.category === "uniforms" ||
    /uniform|chalatas|chalat|marskin|marškin|kelnes|kelnės|dzemper|džemper|svark|švark|avalyn|batai|apron|prijuost/.test(
      text,
    )
  );
}

function isTextileItem(item?: InventoryItem | null) {
  if (!item) return false;
  const text = normalizeText(
    [item.category, item.subcategory, item.name].filter(Boolean).join(" "),
  );
  return (
    item.category === "bedding" ||
    /patalyn|paklod|uzvalk|užvalk|antklod|pagalv|ranksluost|rankšluost|tekstil/.test(
      text,
    )
  );
}

function isConsumableItem(item?: InventoryItem | null) {
  if (!item) return false;
  if (isUniformItem(item) || isTextileItem(item)) return false;
  return true;
}

function isLaundryOut(log: InventoryLog) {
  return String(log.resident_code || "")
    .toLowerCase()
    .includes("skalbykla: išvežta");
}

function isLaundryReturn(log: InventoryLog) {
  return String(log.resident_code || "")
    .toLowerCase()
    .includes("skalbykla: grįžo");
}

function isWriteOff(log: InventoryLog) {
  return (
    String(log.resident_code || "")
      .toLowerCase()
      .includes("nurašyta") ||
    String(log.notes || "")
      .toLowerCase()
      .includes("nurašyta")
  );
}

function movementLabel(log: InventoryLog) {
  if (isLaundryOut(log)) return "Į skalbyklą";
  if (isLaundryReturn(log)) return "Grįžo iš skalbyklos";
  if (isWriteOff(log)) return "Nurašymas";
  if (log.type === "in") return "Papildymas";
  if (log.type === "out") return "Išdavimas";
  return "Koregavimas";
}

async function getActor() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id)
    return { userId: null as string | null, name: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const record = (profile || {}) as Record<string, unknown>;
  const fullName = String(record.full_name || "").trim();
  const firstName = String(record.first_name || "").trim();
  const lastName = String(record.last_name || "").trim();
  const email = String(record.email || user.email || "").trim();

  return {
    userId: user.id,
    name:
      fullName ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      email ||
      null,
  };
}

async function writeAuditLog(input: {
  organizationId: string;
  action: string;
  entityId: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const actor = await getActor();
    const now = new Date().toISOString();
    const base = {
      organization_id: input.organizationId,
      user_id: actor.userId,
      changed_by: actor.userId,
      actor: actor.userId,
      action: input.action,
      created_at: now,
      changed_at: now,
    };

    const attempts = [
      {
        table: "audit_logs",
        payload: {
          ...base,
          entity_type: input.entityType || "inventory",
          entity_id: input.entityId,
          module: "inventory",
          metadata: input.metadata || {},
        },
      },
      {
        table: "audit_log",
        payload: {
          ...base,
          table_name: input.entityType || "inventory_items",
          record_id: input.entityId,
          changes: input.metadata || {},
        },
      },
    ];

    for (const attempt of attempts) {
      const { error } = await supabase
        .from(attempt.table)
        .insert(attempt.payload as never);
      if (!error) return;
    }
  } catch {
    // Auditas neturi nulaužti pagrindinio veiksmo.
  }
}

export default function InventoryPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [residents, setResidents] = useState<PersonOption[]>([]);
  const [employees, setEmployees] = useState<PersonOption[]>([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | StockStatus>("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUniformModal, setShowUniformModal] = useState(false);
  const [showLaundryOutModal, setShowLaundryOutModal] = useState(false);
  const [showLaundryReturnModal, setShowLaundryReturnModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);

  const [addForms, setAddForms] = useState<AddForm[]>([DEFAULT_ADD_FORM]);
  const [movementForm, setMovementForm] =
    useState<SingleMovementForm>(DEFAULT_MOVEMENT);
  const [laundryForm, setLaundryForm] = useState<LaundryForm>(DEFAULT_LAUNDRY);

  useEffect(() => {
    void loadInventory();
  }, []);

  async function loadInventory(options: { clearMessage?: boolean } = {}) {
    try {
      setLoading(true);
      if (options.clearMessage !== false) setMessage("");

      const orgId = await getCurrentOrganizationId();
      if (!orgId) {
        setOrganizationId(null);
        setMessage("Nepavyko nustatyti aktyvios įstaigos.");
        return;
      }
      setOrganizationId(orgId);

      const [itemsResult, logsResult, residentsResult, membersResult] =
        await Promise.all([
          supabase
            .from("inventory_items")
            .select(
              "id, organization_id, name, unit, quantity, category, subcategory, size, min_quantity, is_active, created_at, updated_at",
            )
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase
            .from("inventory_issue_history_view")
            .select(
              "id, organization_id, item_id, item_name, category, subcategory, size, unit, resident_id, resident_code, employee_user_id, employee_full_name, quantity, type, notes, created_at",
            )
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("residents")
            .select("id, first_name, last_name, full_name, resident_code")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase
            .from("organization_members")
            .select("user_id, is_active")
            .eq("organization_id", orgId),
        ]);

      if (itemsResult.error) throw itemsResult.error;
      if (logsResult.error) throw logsResult.error;
      if (residentsResult.error) throw residentsResult.error;
      if (membersResult.error) throw membersResult.error;

      const itemRows = ((itemsResult.data || []) as InventoryItem[]).map(
        (item) => {
          if (isUniformItem(item) && item.category !== "uniforms")
            return { ...item, category: "uniforms" };
          if (isTextileItem(item) && item.category !== "bedding")
            return { ...item, category: "bedding" };
          return item;
        },
      );

      setItems(itemRows);
      setLogs((logsResult.data || []) as InventoryLog[]);
      setResidents(
        ((residentsResult.data || []) as Record<string, unknown>[]).map(
          (resident) => {
            const full = String(resident.full_name || "").trim();
            const first = String(resident.first_name || "").trim();
            const last = String(resident.last_name || "").trim();
            const code = String(resident.resident_code || "").trim();
            return {
              id: String(resident.id),
              label: [
                full ||
                  [first, last].filter(Boolean).join(" ").trim() ||
                  String(resident.id),
                code ? `(${code})` : "",
              ]
                .filter(Boolean)
                .join(" "),
            };
          },
        ),
      );

      const memberRows = (membersResult.data || []) as Record<
        string,
        unknown
      >[];
      const userIds = memberRows
        .map((member) => String(member.user_id || "").trim())
        .filter(Boolean);
      const activeMap = new Map(
        memberRows.map((member) => [
          String(member.user_id || "").trim(),
          member.is_active !== false,
        ]),
      );

      if (!userIds.length) {
        setEmployees([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      setEmployees(
        ((profilesData || []) as Record<string, unknown>[]).map((profile) => {
          const first = String(profile.first_name || "").trim();
          const last = String(profile.last_name || "").trim();
          const full = String(profile.full_name || "").trim();
          const email = String(profile.email || "").trim();
          const id = String(profile.id);
          const active = activeMap.get(id) !== false;
          return {
            id,
            label: `${full || [first, last].filter(Boolean).join(" ").trim() || email || id}${active ? "" : " (neaktyvus)"}`,
            isActive: active,
          };
        }),
      );
    } catch (error) {
      setMessage(getReadableError(error));
      setItems([]);
      setLogs([]);
      setResidents([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(category: InventoryCategory = "diapers") {
    setAddForms([
      {
        ...DEFAULT_ADD_FORM,
        category,
        subcategory: getDefaultSubcategory(category),
        size: getDefaultSize(category),
        unit: category === "bedding" ? "vnt." : "vnt.",
      },
    ]);
    setShowAddModal(true);
  }

  function openMovementModal(
    kind:
      | "refill"
      | "issue"
      | "assign"
      | "uniform"
      | "laundryOut"
      | "laundryReturn"
      | "writeOff",
    itemId = "",
  ) {
    setMovementForm({ ...DEFAULT_MOVEMENT, itemId });
    setLaundryForm({ ...DEFAULT_LAUNDRY, itemId });
    setMessage("");
    if (kind === "refill") setShowRefillModal(true);
    if (kind === "issue") setShowIssueModal(true);
    if (kind === "assign") setShowAssignModal(true);
    if (kind === "uniform") setShowUniformModal(true);
    if (kind === "laundryOut") setShowLaundryOutModal(true);
    if (kind === "laundryReturn") setShowLaundryReturnModal(true);
    if (kind === "writeOff") setShowWriteOffModal(true);
  }

  function updateAddForm(index: number, patch: Partial<AddForm>) {
    setAddForms((previous) =>
      previous.map((form, currentIndex) => {
        if (currentIndex !== index) return form;
        if (patch.category) {
          return {
            ...form,
            ...patch,
            subcategory: getDefaultSubcategory(patch.category),
            size: getDefaultSize(patch.category),
            unit: form.unit || "vnt.",
          };
        }
        return { ...form, ...patch };
      }),
    );
  }

  async function createItems() {
    try {
      const orgId = organizationId || (await getCurrentOrganizationId());
      if (!orgId) {
        setMessage("Nepavyko nustatyti aktyvios įstaigos.");
        return;
      }

      const rows = addForms.map((form) => {
        const name = form.name.trim();
        const quantity = Number(form.quantity || 0);
        const minQuantity = Number(form.minQuantity || 0);
        if (!name) throw new Error("Įrašyk prekės pavadinimą.");
        if (!Number.isFinite(quantity) || quantity < 0)
          throw new Error("Kiekis turi būti 0 arba didesnis.");
        if (!Number.isFinite(minQuantity) || minQuantity < 0)
          throw new Error("Minimalus kiekis turi būti 0 arba didesnis.");
        return {
          organization_id: orgId,
          name,
          category: form.category,
          subcategory: form.subcategory || null,
          size: shouldShowSize(form.category) ? form.size || null : null,
          unit: form.unit.trim() || "vnt.",
          quantity,
          min_quantity: minQuantity,
          is_active: true,
        };
      });

      setSaving(true);
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(rows)
        .select("id");
      if (error) throw error;

      await writeAuditLog({
        organizationId: orgId,
        action:
          rows.length === 1
            ? "inventory.item_created"
            : "inventory.items_created",
        entityType: "inventory_items",
        entityId: data?.[0]?.id || "inventory_items",
        metadata: {
          Prekės: rows.map((row) => row.name).join(", "),
          Kiekis: rows.length,
        },
      });

      setShowAddModal(false);
      setAddForms([DEFAULT_ADD_FORM]);
      setMessage(rows.length === 1 ? "Prekė pridėta." : "Prekės pridėtos.");
      await loadInventory({ clearMessage: false });
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateItemQuantityAndLog(input: {
    mode: "increase" | "decrease" | "nochange";
    item: InventoryItem;
    quantity: number;
    type: MovementType;
    targetId?: string | null;
    targetLabel?: string | null;
    notes?: string | null;
    action: string;
    auditLabel: string;
  }) {
    if (!organizationId) throw new Error("Nepavyko nustatyti įstaigos.");

    const currentQuantity = Number(input.item.quantity || 0);
    const nextQuantity = input.mode === "increase"
      ? currentQuantity + input.quantity
      : input.mode === "decrease"
        ? currentQuantity - input.quantity
        : currentQuantity;
    if (input.mode === "decrease" && input.quantity > currentQuantity) {
      throw new Error(
        `Prekei „${input.item.name}“ sandėlyje yra tik ${formatQuantity(currentQuantity, input.item.unit)}.`,
      );
    }

    const actor = await getActor();

    if (input.mode !== "nochange") {
      const delta =
        input.mode === "increase" ? input.quantity : -input.quantity;
      const { error } = await supabase.rpc("adjust_inventory_item_quantity", {
        p_item_id: input.item.id,
        p_organization_id: organizationId,
        p_delta: delta,
      });
      if (error) throw error;
    }

    const { error: historyError } = await supabase
      .from("inventory_issue_history")
      .insert({
        organization_id: organizationId,
        item_id: input.item.id,
        item_name: input.item.name,
        category: input.item.category,
        subcategory: input.item.subcategory,
        size: input.item.size,
        unit: input.item.unit,
        resident_id: input.targetId || null,
        resident_code: input.targetLabel || null,
        employee_user_id: actor.userId,
        employee_full_name: actor.name,
        quantity: input.quantity,
        type: input.type,
        notes: input.notes || null,
      });
    if (historyError) throw historyError;

    await writeAuditLog({
      organizationId,
      action: input.action,
      entityType: "inventory_items",
      entityId: input.item.id,
      metadata: {
        Veiksmas: input.auditLabel,
        Prekė: input.item.name,
        Kiekis: formatQuantity(input.quantity, input.item.unit),
        Gavėjas: input.targetLabel || null,
        "Likutis prieš": formatQuantity(currentQuantity, input.item.unit),
        "Likutis po": formatQuantity(nextQuantity, input.item.unit),
        Pastabos: input.notes || null,
      },
    });
  }

  async function submitSingleMovement(
    kind: "refill" | "issue" | "assign" | "uniform" | "writeOff",
  ) {
    try {
      if (!organizationId) return;
      const item = items.find((current) => current.id === movementForm.itemId);
      const quantity = Number(movementForm.quantity || 0);
      if (!item) throw new Error("Pasirink prekę.");
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new Error("Kiekis turi būti didesnis nei 0.");

      setSaving(true);
      setMessage("");

      if (kind === "refill") {
        await updateItemQuantityAndLog({
          mode: "increase",
          item,
          quantity,
          type: "in",
          notes: movementForm.notes.trim() || null,
          action: "inventory.refilled",
          auditLabel: "Papildytas sandėlis",
        });
        setShowRefillModal(false);
        setMessage("Sandėlis papildytas.");
      }

      if (kind === "issue") {
        const resident = residents.find(
          (row) => row.id === movementForm.targetId,
        );
        if (!resident) throw new Error("Pasirink gyventoją.");
        if (!isConsumableItem(item))
          throw new Error(
            "Šiam veiksmui rinkis sunaudojamas prekes. Tekstilei naudok „Priskirti naudojimui“, uniformoms – „Išduoti darbuotojui“.",
          );
        await updateItemQuantityAndLog({
          mode: "decrease",
          item,
          quantity,
          type: "out",
          targetId: resident.id,
          targetLabel: resident.label,
          notes: movementForm.notes.trim() || null,
          action: "inventory.consumable_issued",
          auditLabel: "Išduotos sunaudojamos prekės",
        });
        setShowIssueModal(false);
        setMessage("Prekės išduotos gyventojui.");
      }

      if (kind === "assign") {
        const resident = residents.find(
          (row) => row.id === movementForm.targetId,
        );
        if (!resident) throw new Error("Pasirink gyventoją / kambarį.");
        if (!isTextileItem(item))
          throw new Error(
            "Priskyrimui naudok tekstilę / patalynę. Sunaudojamoms prekėms naudok išdavimą.",
          );
        await updateItemQuantityAndLog({
          mode: "decrease",
          item,
          quantity,
          type: "out",
          targetId: resident.id,
          targetLabel: `Naudojama: ${resident.label}`,
          notes: movementForm.notes.trim() || "Priskirta naudojimui",
          action: "inventory.asset_assigned",
          auditLabel: "Priskirta naudojimui",
        });
        setShowAssignModal(false);
        setMessage("Tekstilė priskirta naudojimui.");
      }

      if (kind === "uniform") {
        const employee = employees.find(
          (row) => row.id === movementForm.targetId,
        );
        if (!employee) throw new Error("Pasirink darbuotoją.");
        if (!isUniformItem(item))
          throw new Error("Uniformų išdavime galima rinktis tik uniformas.");
        await updateItemQuantityAndLog({
          mode: "decrease",
          item,
          quantity,
          type: "out",
          targetId: null,
          targetLabel: `Darbuotojas: ${employee.label}`,
          notes: movementForm.notes.trim() || "Uniforma išduota darbuotojui",
          action: "inventory.uniform_issued",
          auditLabel: "Išduota uniforma darbuotojui",
        });
        setShowUniformModal(false);
        setMessage("Uniforma išduota darbuotojui.");
      }

      if (kind === "writeOff") {
        await updateItemQuantityAndLog({
          mode: "decrease",
          item,
          quantity,
          type: "adjustment",
          targetId: null,
          targetLabel: "Nurašyta / išmesta",
          notes: movementForm.notes.trim() || "Nurašyta / išmesta",
          action: "inventory.written_off",
          auditLabel: "Nurašyta / išmesta",
        });
        setShowWriteOffModal(false);
        setMessage("Prekė nurašyta.");
      }

      setMovementForm(DEFAULT_MOVEMENT);
      await loadInventory({ clearMessage: false });
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitLaundry(kind: "out" | "return") {
    try {
      if (!organizationId) return;
      const item = items.find((current) => current.id === laundryForm.itemId);
      const quantity = Number(laundryForm.quantity || 0);
      if (!item) throw new Error("Pasirink tekstilę / uniformą.");
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new Error("Kiekis turi būti didesnis nei 0.");
      if (!isTextileItem(item) && !isUniformItem(item))
        throw new Error("Į skalbyklą siųsk tik tekstilę arba uniformas.");

      setSaving(true);
      setMessage("");

      const unit = laundryForm.unitMode || item.unit || "kg";
      const itemWithUnit = { ...item, unit };

      await updateItemQuantityAndLog({
        mode: kind === "out" ? "decrease" : "increase",
        item: itemWithUnit,
        quantity,
        type: kind === "out" ? "adjustment" : "in",
        targetId: null,
        targetLabel: kind === "out" ? "Skalbykla: išvežta" : "Skalbykla: grįžo",
        notes:
          laundryForm.notes.trim() ||
          (kind === "out" ? "Išvežta į skalbyklą" : "Grįžo iš skalbyklos"),
        action:
          kind === "out"
            ? "inventory.laundry_sent"
            : "inventory.laundry_returned",
        auditLabel:
          kind === "out" ? "Išvežta į skalbyklą" : "Grįžo iš skalbyklos",
      });

      setShowLaundryOutModal(false);
      setShowLaundryReturnModal(false);
      setLaundryForm(DEFAULT_LAUNDRY);
      setMessage(
        kind === "out"
          ? "Užregistruota, kad tekstilė išvežta į skalbyklą."
          : "Užregistruotas grįžimas iš skalbyklos.",
      );
      await loadInventory({ clearMessage: false });
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = q
        ? [
            item.name,
            getCategoryTitle(item.category),
            getSubcategoryLabel(item.category, item.subcategory),
            item.size,
            item.unit,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true;
      const matchesCategory = categoryFilter
        ? item.category === categoryFilter
        : true;
      const matchesStock = stockFilter
        ? getStockStatus(item.quantity, item.min_quantity) === stockFilter
        : true;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [items, q, categoryFilter, stockFilter]);

  const consumableItems = useMemo(
    () => filteredItems.filter(isConsumableItem),
    [filteredItems],
  );
  const textileItems = useMemo(
    () => filteredItems.filter(isTextileItem),
    [filteredItems],
  );
  const uniformItems = useMemo(
    () => filteredItems.filter(isUniformItem),
    [filteredItems],
  );
  const laundryItems = useMemo(
    () => items.filter((item) => isTextileItem(item) || isUniformItem(item)),
    [items],
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!q) return true;
      return [
        log.item_name,
        getCategoryTitle(log.category),
        getSubcategoryLabel(log.category, log.subcategory),
        log.size,
        log.resident_code,
        log.employee_full_name,
        log.notes,
        movementLabel(log),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [logs, q]);

  const laundryLogs = useMemo(
    () =>
      filteredLogs.filter((log) => isLaundryOut(log) || isLaundryReturn(log)),
    [filteredLogs],
  );
  const writeOffLogs = useMemo(
    () => filteredLogs.filter(isWriteOff),
    [filteredLogs],
  );

  const categoryStats = useMemo(() => {
    return CATEGORIES.reduce(
      (acc, category) => {
        const rows = items.filter((item) => item.category === category.code);
        acc[category.code] = {
          items: rows.length,
          quantity: rows.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0,
          ),
          low: rows.filter(
            (item) =>
              getStockStatus(item.quantity, item.min_quantity) === "low",
          ).length,
          empty: rows.filter(
            (item) =>
              getStockStatus(item.quantity, item.min_quantity) === "empty",
          ).length,
        };
        return acc;
      },
      {} as Record<
        InventoryCategory,
        { items: number; quantity: number; low: number; empty: number }
      >,
    );
  }, [items]);

  const globalStats = useMemo(() => {
    const totalItems = items.length;
    const totalQuantity = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
    const low = items.filter(
      (item) => getStockStatus(item.quantity, item.min_quantity) === "low",
    ).length;
    const empty = items.filter(
      (item) => getStockStatus(item.quantity, item.min_quantity) === "empty",
    ).length;
    const laundryOut = laundryLogs
      .filter(isLaundryOut)
      .reduce((sum, log) => sum + Number(log.quantity || 0), 0);
    const laundryReturned = laundryLogs
      .filter(isLaundryReturn)
      .reduce((sum, log) => sum + Number(log.quantity || 0), 0);
    return {
      totalItems,
      totalQuantity,
      low,
      empty,
      movements: logs.length,
      consumables: items.filter(isConsumableItem).length,
      textiles: items.filter(isTextileItem).length,
      uniforms: items.filter(isUniformItem).length,
      laundryBalance: Math.max(0, laundryOut - laundryReturned),
      writeOffs: writeOffLogs.length,
    };
  }, [items, logs, laundryLogs, writeOffLogs]);

  function exportHistory() {
    const rows = filteredLogs.map((row) => ({
      data: formatDate(row.created_at),
      preke: row.item_name || "",
      kategorija: getCategoryTitle(row.category),
      tipas: getSubcategoryLabel(row.category, row.subcategory),
      dydis: row.size || "",
      kiekis: formatQuantity(row.quantity, row.unit),
      operacija: movementLabel(row),
      kam: row.resident_code || "",
      darbuotojas: row.employee_full_name || "",
      pastaba: row.notes || "",
    }));
    const headers = Object.keys(rows[0] || {}) as Array<
      keyof (typeof rows)[number]
    >;
    if (!headers.length) return;
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sandelio_judejimai.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ key: TabKey; label: string; icon: ElementType }> = [
    { key: "overview", label: "Apžvalga", icon: ShieldCheck },
    { key: "stock", label: "Likučiai", icon: Boxes },
    { key: "assigned", label: "Tekstilė", icon: BedDouble },
    { key: "uniforms", label: "Uniformos", icon: Shirt },
    { key: "laundry", label: "Skalbykla", icon: WashingMachine },
    { key: "movements", label: "Judėjimai", icon: RefreshCw },
    { key: "writeoffs", label: "Nurašymai", icon: Trash2 },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ffffff] p-6 text-[#10251f]">
        <div className="rounded-3xl border border-[#c9d8d0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#dbe6e0] border-t-[#486b5d]" />
          <p className="mt-4 text-lg font-black text-[#486b5d]">
            Kraunamas sandėlis...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#ffffff] p-5 text-[#10251f]">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
          <div className="bg-[#486b5d] px-5 py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                  Sandėlio valdymas
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  Sandėlis, tekstilė ir uniformos
                </h1>
                <p className="mt-1 max-w-3xl text-sm font-semibold text-white/80">
                  Vienas darbo langas atsargoms, sunaudojamoms prekėms,
                  tekstilės ciklui, uniformoms, skalbyklai ir nurašymams.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#ffffff] active:scale-[0.98]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atnaujinti
                </button>
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 text-sm font-black text-white/90 ring-1 ring-white/20 transition hover:bg-white/18 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Nauja prekė
                </button>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 border-b border-[#dbe6e0] bg-[#f7fcf9] px-4 py-2 text-sm font-black text-[#486b5d]">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${
                    active
                      ? "bg-white text-[#486b5d] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <Link
              href="/inventory/uniforms"
              className="ml-auto rounded-lg border border-[#c2d3ca] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
            >
              Senas kategorijos vaizdas
            </Link>
          </nav>
        </section>

        {message ? (
          <div className="rounded-2xl border border-[#c9d8d0] bg-[#f7fcf9] p-4 text-sm font-black text-[#486b5d]">
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatButton
            label="Skirtingų prekių"
            value={globalStats.totalItems}
            onClick={() => setTab("stock")}
          />
          <StatButton
            label="Sunaudojamos"
            value={globalStats.consumables}
            onClick={() => setTab("stock")}
          />
          <StatButton
            label="Tekstilė"
            value={globalStats.textiles}
            tone="green"
            onClick={() => setTab("assigned")}
          />
          <StatButton
            label="Uniformos"
            value={globalStats.uniforms}
            tone="green"
            onClick={() => setTab("uniforms")}
          />
          <StatButton
            label="Skalbykloje"
            value={`${globalStats.laundryBalance}`}
            tone="amber"
            onClick={() => setTab("laundry")}
          />
          <StatButton
            label="Rizikos"
            value={globalStats.low + globalStats.empty}
            tone={globalStats.empty > 0 ? "red" : "amber"}
            onClick={() => setStockFilter(stockFilter ? "" : "low")}
          />
          <StatButton
            label="Nurašymai"
            value={globalStats.writeOffs}
            tone="red"
            onClick={() => setTab("writeoffs")}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border border-[#c9d8d0] bg-white p-4 shadow-sm xl:sticky xl:top-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6a7e75]">
                  Greiti veiksmai
                </p>
                <h2 className="text-xl font-black tracking-tight text-[#10251f]">
                  Darbo eiga
                </h2>
              </div>
              <PackageOpen className="h-5 w-5 text-[#486b5d]" />
            </div>

            <div className="grid gap-2">
              <QuickAction
                onClick={() => setShowRefillModal(true)}
                icon={<ArrowUpCircle className="h-4 w-4" />}
                title="Papildyti sandėlį"
                desc="Gauta iš tiekėjo / atsargų"
              />
              <QuickAction
                onClick={() => setShowIssueModal(true)}
                icon={<Send className="h-4 w-4" />}
                title="Išduoti sunaudojamas"
                desc="Sauskelnės, valymas, vaistai"
              />
              <QuickAction
                onClick={() => setShowAssignModal(true)}
                icon={<BedDouble className="h-4 w-4" />}
                title="Priskirti naudojimui"
                desc="Patalynė / tekstilė"
              />
              <QuickAction
                onClick={() => setShowUniformModal(true)}
                icon={<Shirt className="h-4 w-4" />}
                title="Išduoti uniformą"
                desc="Darbuotojui"
              />
              <QuickAction
                onClick={() => setShowLaundryOutModal(true)}
                icon={<WashingMachine className="h-4 w-4" />}
                title="Išvežti į skalbyklą"
                desc="Kg, vnt., maišai"
              />
              <QuickAction
                onClick={() => setShowLaundryReturnModal(true)}
                icon={<CheckCircle2 className="h-4 w-4" />}
                title="Grąžinti iš skalbyklos"
                desc="Fiksuoti grįžusį kiekį"
              />
              <QuickAction
                onClick={() => setShowWriteOffModal(true)}
                icon={<Trash2 className="h-4 w-4" />}
                title="Nurašyti / išmesti"
                desc="Sugadinta, prarasta, sunaikinta"
                danger
              />
            </div>

            <div className="mt-4 rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-3">
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6a7e75]">
                Paieška
              </label>
              <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#dbe6e0] bg-white px-3 text-[#486b5d]">
                <Search className="h-4 w-4" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Prekė, darbuotojas, gyventojas..."
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-[#10251f] outline-none placeholder:text-[#8ea0b5]"
                />
              </div>

              <div className="mt-3 grid gap-2">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-11 rounded-xl border border-[#dbe6e0] bg-white px-3 text-sm font-black text-[#486b5d]"
                >
                  <option value="">Visos kategorijos</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.title}
                    </option>
                  ))}
                </select>
                <select
                  value={stockFilter}
                  onChange={(event) =>
                    setStockFilter(event.target.value as "" | StockStatus)
                  }
                  className="h-11 rounded-xl border border-[#dbe6e0] bg-white px-3 text-sm font-black text-[#486b5d]"
                >
                  <option value="">Visi likučiai</option>
                  <option value="ok">Tvarkoje</option>
                  <option value="low">Baigiasi</option>
                  <option value="empty">Pasibaigė</option>
                </select>
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            {tab === "overview" ? (
              <OverviewPanel
                categoryStats={categoryStats}
                onCategory={(category) => {
                  setCategoryFilter(category);
                  setTab(
                    category === "uniforms"
                      ? "uniforms"
                      : category === "bedding"
                        ? "assigned"
                        : "stock",
                  );
                }}
              />
            ) : null}

            {tab === "stock" ? (
              <InventoryTable
                title="Sandėlio likučiai"
                meta={`Rodoma prekių: ${filteredItems.length}`}
                rows={filteredItems}
                onRefill={(item) => openMovementModal("refill", item.id)}
                onIssue={(item) =>
                  openMovementModal(
                    isUniformItem(item)
                      ? "uniform"
                      : isTextileItem(item)
                        ? "assign"
                        : "issue",
                    item.id,
                  )
                }
                onWriteOff={(item) => openMovementModal("writeOff", item.id)}
              />
            ) : null}

            {tab === "assigned" ? (
              <InventoryTable
                title="Tekstilė / priskiriamos prekės"
                meta={`Rodoma tekstilės prekių: ${textileItems.length}`}
                rows={textileItems}
                onRefill={(item) => openMovementModal("refill", item.id)}
                onIssue={(item) => openMovementModal("assign", item.id)}
                onLaundry={(item) => openMovementModal("laundryOut", item.id)}
                onWriteOff={(item) => openMovementModal("writeOff", item.id)}
              />
            ) : null}

            {tab === "uniforms" ? (
              <InventoryTable
                title="Darbuotojų uniformos"
                meta={`Rodoma uniformų: ${uniformItems.length}`}
                rows={uniformItems}
                onRefill={(item) => openMovementModal("refill", item.id)}
                onIssue={(item) => openMovementModal("uniform", item.id)}
                onLaundry={(item) => openMovementModal("laundryOut", item.id)}
                onWriteOff={(item) => openMovementModal("writeOff", item.id)}
              />
            ) : null}

            {tab === "laundry" ? (
              <LaundryPanel
                logs={laundryLogs}
                balance={globalStats.laundryBalance}
                onOut={() => setShowLaundryOutModal(true)}
                onReturn={() => setShowLaundryReturnModal(true)}
              />
            ) : null}

            {tab === "movements" ? (
              <MovementsPanel
                title="Judėjimo istorija"
                logs={filteredLogs}
                onExport={exportHistory}
              />
            ) : null}
            {tab === "writeoffs" ? (
              <MovementsPanel
                title="Nurašymai / išmetimai"
                logs={writeOffLogs}
                onExport={exportHistory}
              />
            ) : null}
          </main>
        </section>
      </div>

      {showAddModal ? (
        <AddItemsModal
          forms={addForms}
          saving={saving}
          onClose={() => !saving && setShowAddModal(false)}
          onChange={updateAddForm}
          onAddLine={() =>
            setAddForms((previous) => [...previous, { ...DEFAULT_ADD_FORM }])
          }
          onRemoveLine={(index) =>
            setAddForms((previous) =>
              previous.filter((_, current) => current !== index),
            )
          }
          onSubmit={() => void createItems()}
        />
      ) : null}

      {showRefillModal ? (
        <MovementModal
          title="Papildyti sandėlį"
          subtitle="Padidina laisvą sandėlio likutį."
          items={items}
          form={movementForm}
          setForm={setMovementForm}
          saving={saving}
          submitText="Papildyti"
          notePlaceholder="Pvz. gauta iš tiekėjo, sąskaitos nr., papildymo priežastis"
          onClose={() => !saving && setShowRefillModal(false)}
          onSubmit={() => void submitSingleMovement("refill")}
        />
      ) : null}

      {showIssueModal ? (
        <MovementModal
          title="Išduoti sunaudojamas prekes"
          subtitle="Sauskelnės, valymo priemonės, vaistai ar kitos sunaudojamos prekės."
          items={items.filter(isConsumableItem)}
          targets={residents}
          targetLabel="Gyventojas"
          form={movementForm}
          setForm={setMovementForm}
          saving={saving}
          submitText="Išduoti"
          notePlaceholder="Pvz. išduota savaitės poreikiui, higienai ar konkrečiam gyventojo poreikiui"
          danger
          onClose={() => !saving && setShowIssueModal(false)}
          onSubmit={() => void submitSingleMovement("issue")}
        />
      ) : null}

      {showAssignModal ? (
        <MovementModal
          title="Priskirti naudojimui"
          subtitle="Tekstilė lieka apskaitoje, bet iš sandėlio pereina į naudojimą pas gyventoją / kambaryje."
          items={items.filter(isTextileItem)}
          targets={residents}
          targetLabel="Gyventojas / kambarys"
          form={movementForm}
          setForm={setMovementForm}
          saving={saving}
          submitText="Priskirti"
          notePlaceholder="Pvz. priskirta kambariui A101, gyventojo lovai ar konkrečiam komplektui"
          onClose={() => !saving && setShowAssignModal(false)}
          onSubmit={() => void submitSingleMovement("assign")}
        />
      ) : null}

      {showUniformModal ? (
        <MovementModal
          title="Išduoti uniformą"
          subtitle="Uniformos išduodamos darbuotojams ir vėliau gali būti grąžintos / nurašytos."
          items={items.filter(isUniformItem)}
          targets={employees.filter((employee) => employee.isActive !== false)}
          targetLabel="Darbuotojas"
          form={movementForm}
          setForm={setMovementForm}
          saving={saving}
          submitText="Išduoti darbuotojui"
          notePlaceholder="Pvz. išduota naujam darbuotojui, dydžio pakeitimas ar darbo apranga pamainai"
          onClose={() => !saving && setShowUniformModal(false)}
          onSubmit={() => void submitSingleMovement("uniform")}
        />
      ) : null}

      {showLaundryOutModal ? (
        <LaundryModal
          title="Išvežti į skalbyklą"
          subtitle="Fiksuok kg, vnt., maišus ar komplektus."
          items={laundryItems}
          form={laundryForm}
          setForm={setLaundryForm}
          saving={saving}
          submitText="Užregistruoti išvežimą"
          onClose={() => !saving && setShowLaundryOutModal(false)}
          onSubmit={() => void submitLaundry("out")}
        />
      ) : null}

      {showLaundryReturnModal ? (
        <LaundryModal
          title="Grąžinti iš skalbyklos"
          subtitle="Fiksuok grįžusį kiekį ir neatitikimus pastaboje."
          items={laundryItems}
          form={laundryForm}
          setForm={setLaundryForm}
          saving={saving}
          submitText="Patvirtinti grįžimą"
          onClose={() => !saving && setShowLaundryReturnModal(false)}
          onSubmit={() => void submitLaundry("return")}
        />
      ) : null}

      {showWriteOffModal ? (
        <MovementModal
          title="Nurašyti / išmesti"
          subtitle="Naudok sugadintoms, prarastoms ar netinkamoms naudoti prekėms."
          items={items}
          form={movementForm}
          setForm={setMovementForm}
          saving={saving}
          submitText="Nurašyti"
          notePlaceholder="Pvz. sugadinta, susidėvėjo, išmesta arba trūkumas po skalbimo"
          danger
          onClose={() => !saving && setShowWriteOffModal(false)}
          onSubmit={() => void submitSingleMovement("writeOff")}
        />
      ) : null}
    </main>
  );
}

function StatButton({
  label,
  value,
  tone = "default",
  onClick,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "green" | "amber" | "red";
  onClick: () => void;
}) {
  const toneClass =
    tone === "green"
      ? "text-[#486b5d]"
      : tone === "amber"
        ? "text-[#be123c]"
        : tone === "red"
          ? "text-red-700"
          : "text-[#10251f]";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#ffffff]"
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">spausk filtruoti</p>
    </button>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
        danger
          ? "border-red-100 bg-red-50 hover:bg-red-100"
          : "border-[#dbe6e0] bg-[#ffffff] hover:bg-[#f7fcf9]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? "bg-white text-red-700" : "bg-white text-[#486b5d]"}`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <b className="block truncate text-sm font-black text-[#10251f]">
            {title}
          </b>
          <small className="block truncate text-xs font-bold text-[#66756c]">
            {desc}
          </small>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#8ea0b5] transition group-hover:translate-x-0.5" />
    </button>
  );
}

function OverviewPanel({
  categoryStats,
  onCategory,
}: {
  categoryStats: Record<
    InventoryCategory,
    { items: number; quantity: number; low: number; empty: number }
  >;
  onCategory: (category: InventoryCategory) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#c9d8d0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#486b5d]">
            Apžvalga
          </p>
          <h2 className="text-2xl font-black tracking-tight text-[#10251f]">
            Sandėlio kategorijos
          </h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const stats = categoryStats[category.code];
          const risk = stats.low + stats.empty;
          return (
            <button
              key={category.code}
              type="button"
              onClick={() => onCategory(category.code)}
              className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-4 text-left transition hover:border-[#c9d8d0] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#486b5d] shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${risk ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {risk ? `${risk} riz.` : "Tvarkoje"}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-[#10251f]">
                {category.title}
              </h3>
              <p className="mt-1 text-sm font-bold leading-5 text-[#66756c]">
                {category.description}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Prekių" value={stats.items} />
                <MiniStat label="Kiekis" value={stats.quantity} />
                <MiniStat label="Rizika" value={risk} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="rounded-xl bg-white p-2">
      <b className="block text-base font-black text-[#10251f]">{value}</b>
      <small className="text-[11px] font-black uppercase text-[#6a7e75]">
        {label}
      </small>
    </span>
  );
}

function InventoryTable({
  title,
  meta,
  rows,
  onRefill,
  onIssue,
  onLaundry,
  onWriteOff,
}: {
  title: string;
  meta: string;
  rows: InventoryItem[];
  onRefill: (item: InventoryItem) => void;
  onIssue: (item: InventoryItem) => void;
  onLaundry?: (item: InventoryItem) => void;
  onWriteOff: (item: InventoryItem) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dbe6e0] p-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#10251f]">
            {title}
          </h2>
          <p className="mt-1 text-sm font-bold text-[#66756c]">{meta}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState text="Pagal pasirinktus filtrus įrašų nėra." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#ffffff] text-[11px] uppercase tracking-[0.12em] text-[#6a7e75]">
              <tr>
                <th className="px-4 py-3 font-black">Prekė</th>
                <th className="px-4 py-3 font-black">Kategorija</th>
                <th className="px-4 py-3 font-black">Tipas</th>
                <th className="px-4 py-3 font-black">Dydis / matmuo</th>
                <th className="px-4 py-3 font-black">Likutis</th>
                <th className="px-4 py-3 font-black">Būsena</th>
                <th className="px-4 py-3 font-black">Veiksmai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ef] text-sm">
              {rows.map((item) => {
                const status = getStockStatus(item.quantity, item.min_quantity);
                return (
                  <tr key={item.id} className="align-top hover:bg-[#ffffff]">
                    <td className="px-4 py-4 font-black text-[#10251f]">
                      {item.name || "—"}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#486b5d]">
                      {getCategoryTitle(item.category)}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#66756c]">
                      {getSubcategoryLabel(item.category, item.subcategory)}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#66756c]">
                      {item.size || "—"}
                    </td>
                    <td className="px-4 py-4 font-black text-[#10251f]">
                      {formatQuantity(item.quantity, item.unit)}
                    </td>
                    <td className="px-4 py-4">
                      <StockBadge status={status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <SmallButton onClick={() => onRefill(item)}>
                          Papildyti
                        </SmallButton>
                        <SmallButton onClick={() => onIssue(item)} tone="green">
                          {isUniformItem(item)
                            ? "Išduoti darbuotojui"
                            : isTextileItem(item)
                              ? "Priskirti"
                              : "Išduoti"}
                        </SmallButton>
                        {onLaundry ? (
                          <SmallButton onClick={() => onLaundry(item)}>
                            Į skalbyklą
                          </SmallButton>
                        ) : null}
                        <SmallButton
                          onClick={() => onWriteOff(item)}
                          tone="red"
                        >
                          Nurašyti
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LaundryPanel({
  logs,
  balance,
  onOut,
  onReturn,
}: {
  logs: InventoryLog[];
  balance: number;
  onOut: () => void;
  onReturn: () => void;
}) {
  const sent = logs
    .filter(isLaundryOut)
    .reduce((sum, log) => sum + Number(log.quantity || 0), 0);
  const returned = logs
    .filter(isLaundryReturn)
    .reduce((sum, log) => sum + Number(log.quantity || 0), 0);
  const mismatch = Math.max(0, sent - returned);
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#c9d8d0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#486b5d]">
              Skalbyklos apskaita
            </p>
            <h2 className="text-2xl font-black tracking-tight text-[#10251f]">
              Tekstilės judėjimas
            </h2>
            <p className="mt-1 text-sm font-bold text-[#66756c]">
              Fiksuok, kiek išvežta į skalbyklą, kiek grįžo ir ar yra
              neatitikimų.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOut}
              className="rounded-xl bg-[#486b5d] px-4 py-2 text-sm font-black text-white"
            >
              Išvežti
            </button>
            <button
              type="button"
              onClick={onReturn}
              className="rounded-xl border border-[#c9d8d0] bg-white px-4 py-2 text-sm font-black text-[#486b5d]"
            >
              Grąžinti
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <LaundryStat label="Išvežta" value={formatQuantity(sent, "")} />
          <LaundryStat label="Grįžo" value={formatQuantity(returned, "")} />
          <LaundryStat
            label="Balansas"
            value={formatQuantity(balance || mismatch, "")}
            warning={mismatch > 0}
          />
        </div>
      </div>
      <MovementsPanel title="Skalbyklos istorija" logs={logs} />
    </section>
  );
}

function LaundryStat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${warning ? "border-amber-100 bg-amber-50" : "border-[#dbe6e0] bg-[#ffffff]"}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6a7e75]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-[#10251f]">{value}</p>
    </div>
  );
}

function MovementsPanel({
  title,
  logs,
  onExport,
}: {
  title: string;
  logs: InventoryLog[];
  onExport?: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dbe6e0] p-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#10251f]">
            {title}
          </h2>
          <p className="mt-1 text-sm font-bold text-[#66756c]">
            Rodoma įrašų: {logs.length}
          </p>
        </div>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-[#c9d8d0] bg-white px-4 py-2 text-sm font-black text-[#486b5d]"
          >
            <Download className="h-4 w-4" /> Eksportuoti
          </button>
        ) : null}
      </div>
      {logs.length === 0 ? (
        <EmptyState text="Įrašų nėra." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="bg-[#ffffff] text-[11px] uppercase tracking-[0.12em] text-[#6a7e75]">
              <tr>
                <th className="px-4 py-3 font-black">Data</th>
                <th className="px-4 py-3 font-black">Prekė</th>
                <th className="px-4 py-3 font-black">Operacija</th>
                <th className="px-4 py-3 font-black">Kiekis</th>
                <th className="px-4 py-3 font-black">Kam / būsena</th>
                <th className="px-4 py-3 font-black">Darbuotojas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ef] text-sm">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#ffffff]">
                  <td className="px-4 py-4 font-bold text-[#66756c]">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-4 font-black text-[#10251f]">
                    {log.item_name || "—"}
                    <div className="mt-1 text-xs font-bold text-[#8ea0b5]">
                      {getSubcategoryLabel(log.category, log.subcategory)}
                      {log.size ? ` · ${log.size}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <MovementBadge log={log} />
                  </td>
                  <td className="px-4 py-4 font-black text-[#10251f]">
                    {formatQuantity(log.quantity, log.unit)}
                  </td>
                  <td className="px-4 py-4 font-bold text-[#486b5d]">
                    {log.resident_code || "—"}
                  </td>
                  <td className="px-4 py-4 font-bold text-[#66756c]">
                    {log.employee_full_name || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StockBadge({ status }: { status: StockStatus }) {
  const cls =
    status === "empty"
      ? "bg-red-50 text-red-700"
      : status === "low"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>
      {getStockLabel(status)}
    </span>
  );
}

function MovementBadge({ log }: { log: InventoryLog }) {
  const label = movementLabel(log);
  const isOut = log.type === "out" || isLaundryOut(log) || isWriteOff(log);
  const cls = isWriteOff(log)
    ? "bg-red-50 text-red-700"
    : isOut
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${cls}`}
    >
      {isOut ? (
        <ArrowDownCircle className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function SmallButton({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "green" | "red";
}) {
  const cls =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "green"
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : "border-[#dbe6e0] bg-white text-[#486b5d]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-black ${cls}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="m-4 rounded-2xl border border-dashed border-[#c9d8d0] bg-[#ffffff] p-8 text-center text-sm font-black text-[#66756c]">
      {text}
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
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="max-h-[calc(100vh-40px)] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#dbe6e0] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-white/80">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto bg-[#ffffff] p-5">
          {children}
        </div>
      </section>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-[#486b5d]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-4 focus:ring-[#486b5d]/10";
const textareaClass =
  "min-h-24 w-full rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-4 focus:ring-[#486b5d]/10";

function AddItemsModal({
  forms,
  saving,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  forms: AddForm[];
  saving: boolean;
  onClose: () => void;
  onChange: (index: number, patch: Partial<AddForm>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      title="Pridėti prekes"
      subtitle="Gali pridėti kelias prekes vienu kartu."
      onClose={onClose}
    >
      <div className="grid gap-3">
        {forms.map((form, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-2xl border border-[#dbe6e0] bg-white p-4 md:grid-cols-3"
          >
            <FormField label="Pavadinimas *">
              <input
                value={form.name}
                onChange={(event) =>
                  onChange(index, { name: event.target.value })
                }
                className={inputClass}
                placeholder="Pvz. Chalatas L"
              />
            </FormField>
            <FormField label="Kategorija">
              <select
                value={form.category}
                onChange={(event) =>
                  onChange(index, {
                    category: event.target.value as InventoryCategory,
                  })
                }
                className={inputClass}
              >
                {CATEGORIES.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tipas">
              <select
                value={form.subcategory}
                onChange={(event) =>
                  onChange(index, { subcategory: event.target.value })
                }
                className={inputClass}
              >
                {SUBCATEGORY_OPTIONS[form.category].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            {shouldShowSize(form.category) ? (
              <FormField
                label={form.category === "bedding" ? "Matmuo / vnt." : "Dydis"}
              >
                {SIZE_OPTIONS[form.category]?.length ? (
                  <select
                    value={form.size}
                    onChange={(event) =>
                      onChange(index, { size: event.target.value })
                    }
                    className={inputClass}
                  >
                    {SIZE_OPTIONS[form.category]?.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.size}
                    onChange={(event) =>
                      onChange(index, { size: event.target.value })
                    }
                    className={inputClass}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="Vienetas">
              <input
                value={form.unit}
                onChange={(event) =>
                  onChange(index, { unit: event.target.value })
                }
                className={inputClass}
              />
            </FormField>
            <FormField label="Kiekis">
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) =>
                  onChange(index, { quantity: event.target.value })
                }
                className={inputClass}
              />
            </FormField>
            <FormField label="Min. kiekis">
              <input
                type="number"
                min="0"
                value={form.minQuantity}
                onChange={(event) =>
                  onChange(index, { minQuantity: event.target.value })
                }
                className={inputClass}
              />
            </FormField>
            {forms.length > 1 ? (
              <button
                type="button"
                onClick={() => onRemoveLine(index)}
                className="self-end rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700"
              >
                Pašalinti
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <ModalActions
        saving={saving}
        onClose={onClose}
        onSubmit={onSubmit}
        submitText="Išsaugoti"
        extra={
          <button
            type="button"
            onClick={onAddLine}
            className="rounded-2xl border border-[#c9d8d0] bg-white px-4 py-3 text-sm font-black text-[#486b5d]"
          >
            Pridėti eilutę
          </button>
        }
      />
    </Modal>
  );
}

function MovementModal({
  title,
  subtitle,
  items,
  targets = [],
  targetLabel,
  form,
  setForm,
  saving,
  submitText,
  notePlaceholder = "Įrašyk papildomą informaciją apie veiksmą",
  danger = false,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  items: InventoryItem[];
  targets?: PersonOption[];
  targetLabel?: string;
  form: SingleMovementForm;
  setForm: (form: SingleMovementForm) => void;
  saving: boolean;
  submitText: string;
  notePlaceholder?: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const selected = items.find((item) => item.id === form.itemId) || null;
  const [categoryFilter, setCategoryFilter] = useState<string>(
    selected?.category || "",
  );

  const categoryOptions = useMemo(() => {
    const codes = Array.from(
      new Set(items.map((item) => item.category).filter(Boolean) as string[]),
    );
    return codes
      .map((code) => ({ code, label: getCategoryTitle(code) }))
      .sort((a, b) => a.label.localeCompare(b.label, "lt"));
  }, [items]);

  const visibleItems = useMemo(() => {
    const rows = categoryFilter
      ? items.filter((item) => item.category === categoryFilter)
      : items;
    return [...rows].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "lt"),
    );
  }, [items, categoryFilter]);

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="grid gap-4 rounded-2xl border border-[#dbe6e0] bg-white p-4 md:grid-cols-2">
        <FormField label="Kategorija">
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setForm({ ...form, itemId: "" });
            }}
            className={inputClass}
          >
            <option value="">Visos kategorijos</option>
            {categoryOptions.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Prekė *">
          <select
            value={form.itemId}
            onChange={(event) =>
              setForm({ ...form, itemId: event.target.value, targetId: "" })
            }
            className={inputClass}
          >
            <option value="">Pasirink prekę</option>
            {visibleItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {getCategoryTitle(item.category)}
                {item.size ? ` · ${item.size}` : ""} —{" "}
                {formatQuantity(item.quantity, item.unit)}
              </option>
            ))}
          </select>
        </FormField>
        {targetLabel ? (
          <FormField label={`${targetLabel} *`}>
            <select
              value={form.targetId}
              onChange={(event) =>
                setForm({ ...form, targetId: event.target.value })
              }
              className={inputClass}
            >
              <option value="">
                Pasirink {targetLabel?.toLowerCase() || "gavėją"}
              </option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField label="Kiekis *">
          <input
            type="number"
            min="1"
            max={selected ? Number(selected.quantity || 0) : undefined}
            value={form.quantity}
            onChange={(event) =>
              setForm({ ...form, quantity: event.target.value })
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Pastaba">
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            className={textareaClass}
            placeholder={notePlaceholder}
          />
        </FormField>
      </div>
      <ModalActions
        saving={saving}
        onClose={onClose}
        onSubmit={onSubmit}
        submitText={submitText}
        danger={danger}
      />
    </Modal>
  );
}

function LaundryModal({
  title,
  subtitle,
  items,
  form,
  setForm,
  saving,
  submitText,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  items: InventoryItem[];
  form: LaundryForm;
  setForm: (form: LaundryForm) => void;
  saving: boolean;
  submitText: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="grid gap-4 rounded-2xl border border-[#dbe6e0] bg-white p-4 md:grid-cols-2">
        <FormField label="Tekstilė / uniforma *">
          <select
            value={form.itemId}
            onChange={(event) =>
              setForm({ ...form, itemId: event.target.value })
            }
            className={inputClass}
          >
            <option value="">Pasirink prekę</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatQuantity(item.quantity, item.unit)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Mato vienetas">
          <select
            value={form.unitMode}
            onChange={(event) =>
              setForm({ ...form, unitMode: event.target.value })
            }
            className={inputClass}
          >
            <option value="kg">kg</option>
            <option value="vnt.">vnt.</option>
            <option value="maišai">maišai</option>
            <option value="komplektai">komplektai</option>
          </select>
        </FormField>
        <FormField label="Kiekis *">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={form.quantity}
            onChange={(event) =>
              setForm({ ...form, quantity: event.target.value })
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Pastaba">
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            className={textareaClass}
            placeholder="Pvz. 3 maišai iš 1 aukšto, trūksta 1 paklodės"
          />
        </FormField>
      </div>
      <ModalActions
        saving={saving}
        onClose={onClose}
        onSubmit={onSubmit}
        submitText={submitText}
      />
    </Modal>
  );
}

function ModalActions({
  saving,
  onClose,
  onSubmit,
  submitText,
  danger = false,
  extra,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitText: string;
  notePlaceholder?: string;
  danger?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      {extra}
      <button
        type="button"
        onClick={onClose}
        className="rounded-2xl border border-[#c9d8d0] bg-white px-4 py-3 text-sm font-black text-[#486b5d]"
      >
        Atšaukti
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className={`rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#486b5d] hover:bg-[#39594c]"}`}
      >
        {saving ? "Saugoma..." : submitText}
      </button>
    </div>
  );
}
