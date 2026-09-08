import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  ClipboardCopy,
  Download,
  FileText,
  Globe,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Pencil,
  PlusCircle,
  Plus,
  Target,
  Users,
  Search,
  Trash2,
  CheckCircle2,
  PenTool,
} from "lucide-react";

type PaperStatus = "en_proceso" | "finalizado";
type PayStatus = "pendiente" | "pagado";
type RecordKind = "papers" | "patents";
type PatentStatus = "inicio" | "en_proceso" | "finalizado";
type PatentCategory = "modelo_inventiva" | "modelo_utilidad" | "diseno_industrial";

type PaperRecord = {
  id: string;
  titulo: string;
  integrantes: number;
  sede: string;
  ods: string[];
  lineaInvestigacion: string;
  paisRevista: string;
  status: PaperStatus;
  linkRevista: string;
  pagoStatus: PayStatus;
  pagoDriveUrl: string;
  pagoMontoPen: number;
  createdAt: string;
  updatedAt: string;
};

type PatentRecord = {
  id: string;
  nombre: string;
  inventor: string;
  sede: string;
  categoria: PatentCategory;
  status: PatentStatus;
  link: string;
  numeroExpediente: string;
  fechaSolicitud: string;
  createdAt: string;
  updatedAt: string;
};

type Screen = "dashboard" | "records" | "detail" | "report_papers" | "report_patents";
type ViewState = { screen: Screen; selectedId: string | null };
type SessionState = { user: string; loggedIn: boolean };

const ODS_OPTIONS = [
  "ODS 1",
  "ODS 2",
  "ODS 3",
  "ODS 4",
  "ODS 5",
  "ODS 6",
  "ODS 7",
  "ODS 8",
  "ODS 9",
  "ODS 10",
  "ODS 11",
  "ODS 12",
  "ODS 13",
  "ODS 14",
  "ODS 15",
  "ODS 16",
  "ODS 17",
];

const SEDES = ["Huancayo", "Arequipa", "Lima", "Ica", "Ayacucho", "Cusco"];
const PATENT_SEDES = ["Arequipa", "Cusco", "Huancayo", "Ica", "Ayacucho"];

const PATENT_CATEGORIES: { value: PatentCategory; label: string }[] = [
  { value: "modelo_inventiva", label: "Modelo de invención" },
  { value: "modelo_utilidad", label: "Modelo de utilidad" },
  { value: "diseno_industrial", label: "Diseno industrial" },
];

const LINEA_ODS_MAP: Record<string, string[]> = {
  "Cambio climático": ["ODS 13", "ODS 11", "ODS 2"],
  "Energías renovables": ["ODS 7"],
  "Tecnologías para la educación": ["ODS 4", "ODS 3", "ODS 1", "ODS 17"],
  "Emprendedurismo e innovación": ["ODS 9", "ODS 17"],
  "Salud pública": ["ODS 3"],
  "Gestión y políticas públicas": ["ODS 3", "ODS 5", "ODS 8", "ODS 10", "ODS 1"],
};

const LINEA_OPTIONS = Object.keys(LINEA_ODS_MAP);

const RECORD_LABELS: Record<RecordKind, { plural: string; singular: string; badge: string }> = {
  papers: { plural: "Articulos / Papers", singular: "paper", badge: "SciManage" },
  patents: { plural: "Patentes", singular: "patente", badge: "SciManage" },
};

const SEED_PAPERS: PaperRecord[] = [
  {
    id: "pp-001",
    titulo: "Análisis de datos abiertos para movilidad urbana",
    integrantes: 3,
    sede: "Lima",
    ods: ["ODS 13", "ODS 11", "ODS 2"],
    lineaInvestigacion: "Cambio climático",
    paisRevista: "Colombia",
    status: "finalizado",
    linkRevista: "https://revistas.example.com/urban-mobility",
    pagoStatus: "pagado",
    pagoDriveUrl: "https://drive.google.com/example-proof-1",
    pagoMontoPen: 0,
    createdAt: "2025-08-19T14:05:00.000Z",
    updatedAt: "2025-08-22T10:12:00.000Z",
  },
  {
    id: "pp-002",
    titulo: "Detección temprana de erosión en suelos agrícolas",
    integrantes: 4,
    sede: "Huancayo",
    ods: ["ODS 7"],
    lineaInvestigacion: "Energías renovables",
    paisRevista: "Mexico",
    status: "en_proceso",
    linkRevista: "https://revistas.example.com/soil-erosion",
    pagoStatus: "pendiente",
    pagoDriveUrl: "",
    pagoMontoPen: 0,
    createdAt: "2025-10-05T10:20:00.000Z",
    updatedAt: "2025-10-05T10:20:00.000Z",
  },
  {
    id: "pp-003",
    titulo: "Impacto de IA generativa en educación superior",
    integrantes: 5,
    sede: "Arequipa",
    ods: ["ODS 4", "ODS 3", "ODS 1", "ODS 17"],
    lineaInvestigacion: "Tecnologías para la educación",
    paisRevista: "Chile",
    status: "en_proceso",
    linkRevista: "https://revistas.example.com/ai-edu",
    pagoStatus: "pagado",
    pagoDriveUrl: "https://drive.google.com/example-proof-2",
    pagoMontoPen: 0,
    createdAt: "2025-09-02T09:45:00.000Z",
    updatedAt: "2025-10-01T11:05:00.000Z",
  },
  {
    id: "pp-004",
    titulo: "Modelos predictivos de salud pública en zonas rurales",
    integrantes: 2,
    sede: "Cusco",
    ods: ["ODS 3"],
    lineaInvestigacion: "Salud pública",
    paisRevista: "Peru",
    status: "finalizado",
    linkRevista: "https://revistas.example.com/health-rural",
    pagoStatus: "pagado",
    pagoDriveUrl: "https://drive.google.com/example-proof-3",
    pagoMontoPen: 0,
    createdAt: "2025-07-11T08:10:00.000Z",
    updatedAt: "2025-08-01T08:10:00.000Z",
  },
];

const SEED_PATENTS: PatentRecord[] = [
  {
    id: "pt-001",
    nombre: "Sistema de captura solar modular para zonas rurales",
    inventor: "Maria Quispe",
    sede: "Arequipa",
    categoria: "modelo_inventiva",
    status: "en_proceso",
    link: "https://patentes.example.com/solar-modular",
    numeroExpediente: "PE-2025-00123",
    fechaSolicitud: "2025-05-12",
    createdAt: "2025-09-12T10:20:00.000Z",
    updatedAt: "2025-09-12T10:20:00.000Z",
  },
  {
    id: "pt-002",
    nombre: "Plataforma de aprendizaje adaptativo con IA",
    inventor: "Luis Medina",
    sede: "Cusco",
    categoria: "modelo_utilidad",
    status: "finalizado",
    link: "https://patentes.example.com/ia-adaptativo",
    numeroExpediente: "PE-2024-00877",
    fechaSolicitud: "2024-11-18",
    createdAt: "2025-06-10T08:30:00.000Z",
    updatedAt: "2025-07-01T09:00:00.000Z",
  },
  {
    id: "pt-003",
    nombre: "Dispositivo portatil para monitoreo de salud comunitaria",
    inventor: "Ana Flores",
    sede: "Huancayo",
    categoria: "diseno_industrial",
    status: "en_proceso",
    link: "https://patentes.example.com/health-monitor",
    numeroExpediente: "PE-2025-00411",
    fechaSolicitud: "2025-09-02",
    createdAt: "2025-11-03T13:15:00.000Z",
    updatedAt: "2025-11-03T13:15:00.000Z",
  },
];

const API_BASE =
  typeof window !== "undefined" && (window as any).__APP_CONFIG__?.VITE_API_URL
    ? String((window as any).__APP_CONFIG__.VITE_API_URL)
    : "";

function apiUrl(pathname: string) {
  return `${API_BASE}${pathname}`;
}

async function apiJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(pathname), {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "request_failed");
  return data as T;
}

async function listPapers() {
  return apiJson<PaperRecord[]>("/api/scimanage/papers");
}

async function createPaper(record: PaperRecord) {
  return apiJson<PaperRecord>("/api/scimanage/papers", {
    method: "POST",
    body: JSON.stringify(record),
  });
}

async function updatePaper(record: PaperRecord) {
  return apiJson<PaperRecord>(`/api/scimanage/papers/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

async function deletePaper(id: string) {
  return apiJson<{ ok: boolean }>(`/api/scimanage/papers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function listPatents() {
  return apiJson<PatentRecord[]>("/api/scimanage/patents");
}

async function createPatent(record: PatentRecord) {
  return apiJson<PatentRecord>("/api/scimanage/patents", {
    method: "POST",
    body: JSON.stringify(record),
  });
}

async function updatePatent(record: PatentRecord) {
  return apiJson<PatentRecord>(`/api/scimanage/patents/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

async function deletePatent(id: string) {
  return apiJson<{ ok: boolean }>(`/api/scimanage/patents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function useLocal<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidUrl(value: string) {
  return /^https?:\/\/\S+/i.test(value);
}

function groupCountBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const bucket = key(item) || "Sin dato";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
}

function formatPen(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function paidAmount(record: PaperRecord) {
  return record.pagoStatus === "pagado" ? Math.max(0, Number(record.pagoMontoPen || 0)) : 0;
}

function groupPaidAmountBySede(records: PaperRecord[]) {
  return records.reduce<Record<string, number>>((acc, record) => {
    const bucket = record.sede || "Sin dato";
    acc[bucket] = (acc[bucket] || 0) + paidAmount(record);
    return acc;
  }, {});
}

function computeKpis(records: PaperRecord[]) {
  const total = records.length;
  const enProceso = records.filter((r) => r.status === "en_proceso").length;
  const finalizados = records.filter((r) => r.status === "finalizado").length;
  const pagados = records.filter((r) => r.pagoStatus === "pagado").length;
  const pendientes = records.filter((r) => r.pagoStatus === "pendiente").length;
  const montoPagadoPen = records.reduce((acc, record) => acc + paidAmount(record), 0);
  const pctFinalizados = total ? Math.round((finalizados / total) * 100) : 0;
  const pctPagados = total ? Math.round((pagados / total) * 100) : 0;
  return { total, enProceso, finalizados, pagados, pendientes, montoPagadoPen, pctFinalizados, pctPagados };
}

function computePatentKpis(records: PatentRecord[]) {
  const total = records.length;
  const inicio = records.filter((r) => r.status === "inicio").length;
  const enProceso = records.filter((r) => r.status === "en_proceso").length;
  const finalizados = records.filter((r) => r.status === "finalizado").length;
  const pctFinalizados = total ? Math.round((finalizados / total) * 100) : 0;
  return { total, inicio, enProceso, finalizados, pctFinalizados };
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function odsCounts(records: PaperRecord[]) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    if (!record.ods.length) {
      counts["Sin ODS"] = (counts["Sin ODS"] || 0) + 1;
      continue;
    }
    record.ods.forEach((ods) => {
      counts[ods] = (counts[ods] || 0) + 1;
    });
  }
  return counts;
}

const EMPTY_FORM: PaperRecord = {
  id: "",
  titulo: "",
  integrantes: 1,
  sede: "",
  ods: [],
  lineaInvestigacion: "",
  paisRevista: "",
  status: "en_proceso",
  linkRevista: "",
  pagoStatus: "pendiente",
  pagoDriveUrl: "",
  pagoMontoPen: 0,
  createdAt: "",
  updatedAt: "",
};

const EMPTY_PATENT: PatentRecord = {
  id: "",
  nombre: "",
  inventor: "",
  sede: "",
  categoria: "modelo_inventiva",
  status: "inicio",
  link: "",
  numeroExpediente: "",
  fechaSolicitud: "",
  createdAt: "",
  updatedAt: "",
};

export default function App() {
  const [session, setSession] = useLocal<SessionState>("sb_session", {
    user: "",
    loggedIn: false,
  });
  const [papers, setPapers] = useState<PaperRecord[]>([]);
  const [patents, setPatents] = useState<PatentRecord[]>([]);
  const [activeKind, setActiveKind] = useLocal<RecordKind>("sb_kind", "papers");
  const [view, setView] = useLocal<ViewState>("sb_view", {
    screen: "dashboard",
    selectedId: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [paperFilters, setPaperFilters] = useState({
    search: "",
    status: "todos",
    pagoStatus: "todos",
    sede: "todas",
  });
  const [patentFilters, setPatentFilters] = useState({
    search: "",
    status: "todos",
    sede: "todas",
    categoria: "todas",
  });

  const filteredPapers = useMemo(() => {
    const needle = paperFilters.search.toLowerCase().trim();
    return papers.filter((record) => {
      const haystack = `${record.titulo} ${record.sede} ${record.lineaInvestigacion} ${record.paisRevista}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (paperFilters.status !== "todos" && record.status !== paperFilters.status) return false;
      if (paperFilters.pagoStatus !== "todos" && record.pagoStatus !== paperFilters.pagoStatus) return false;
      if (paperFilters.sede !== "todas" && record.sede !== paperFilters.sede) return false;
      return true;
    });
  }, [paperFilters, papers]);

  const filteredPatents = useMemo(() => {
    const needle = patentFilters.search.toLowerCase().trim();
    return patents.filter((record) => {
      const haystack = `${record.nombre} ${record.inventor} ${record.sede} ${record.categoria}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (patentFilters.status !== "todos" && record.status !== patentFilters.status) return false;
      if (patentFilters.sede !== "todas" && record.sede !== patentFilters.sede) return false;
      if (patentFilters.categoria !== "todas" && record.categoria !== patentFilters.categoria) return false;
      return true;
    });
  }, [patentFilters, patents]);

  const patentKpis = useMemo(() => computePatentKpis(filteredPatents), [filteredPatents]);
  const patentCategoryCounts = useMemo(
    () => groupCountBy(filteredPatents, (r) => formatPatentCategory(r.categoria)),
    [filteredPatents]
  );

  const sedeOptions = useMemo(() => ["todas", ...SEDES], []);
  const patentSedeOptions = useMemo(() => ["todas", ...PATENT_SEDES], []);

  const selectedPaper = papers.find((p) => p.id === view.selectedId) || null;
  const selectedPatent = patents.find((p) => p.id === view.selectedId) || null;
  const labels = RECORD_LABELS[activeKind];
  const isReport = view.screen === "report_papers" || view.screen === "report_patents";

  React.useEffect(() => {
    if (view.screen === "report_papers" && activeKind !== "papers") {
      setActiveKind("papers");
    }
    if (view.screen === "report_patents" && activeKind !== "patents") {
      setActiveKind("patents");
    }
  }, [activeKind, setActiveKind, view.screen]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadFromApi() {
      setIsSyncing(true);
      try {
        const [papersRows, patentsRows] = await Promise.all([listPapers(), listPatents()]);
        if (cancelled) return;
        setPapers(Array.isArray(papersRows) ? papersRows : []);
        setPatents(Array.isArray(patentsRows) ? patentsRows : []);
        setSyncError("");
      } catch (error) {
        console.error("Error cargando datos de Scimanage:", error);
        if (cancelled) return;
        setSyncError("No se pudo conectar a la base de datos de Scimanage.");
        setPapers(SEED_PAPERS);
        setPatents(SEED_PATENTS);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    }
    loadFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    setSession({ user: "", loggedIn: false });
    setView({ screen: "dashboard", selectedId: null });
  }

  async function handleSavePaper(record: PaperRecord, mode: "create" | "edit") {
    try {
      const saved = mode === "create" ? await createPaper(record) : await updatePaper(record);
      if (mode === "create") {
        setPapers((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      } else {
        setPapers((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      }
      setSyncError("");
      setView({ screen: "records", selectedId: null });
    } catch (error) {
      console.error("Error guardando paper:", error);
      setSyncError("No se pudo guardar el paper en base de datos.");
      alert("No se pudo guardar el registro de paper.");
    }
  }

  async function handleSavePatent(record: PatentRecord, mode: "create" | "edit") {
    try {
      const saved = mode === "create" ? await createPatent(record) : await updatePatent(record);
      if (mode === "create") {
        setPatents((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      } else {
        setPatents((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      }
      setSyncError("");
      setView({ screen: "records", selectedId: null });
    } catch (error) {
      console.error("Error guardando patente:", error);
      setSyncError("No se pudo guardar la patente en base de datos.");
      alert("No se pudo guardar el registro de patente.");
    }
  }

  async function handleDeletePaper(id: string) {
    if (!window.confirm("Eliminar este registro?")) return;
    try {
      await deletePaper(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      setSyncError("");
    } catch (error) {
      console.error("Error eliminando paper:", error);
      setSyncError("No se pudo eliminar el paper en base de datos.");
      alert("No se pudo eliminar el registro de paper.");
    }
  }

  async function handleDeletePatent(id: string) {
    if (!window.confirm("Eliminar este registro?")) return;
    try {
      await deletePatent(id);
      setPatents((prev) => prev.filter((p) => p.id !== id));
      setSyncError("");
    } catch (error) {
      console.error("Error eliminando patente:", error);
      setSyncError("No se pudo eliminar la patente en base de datos.");
      alert("No se pudo eliminar el registro de patente.");
    }
  }

  function handleDuplicatePaper(record: PaperRecord) {
    const now = new Date().toISOString();
    const clone: PaperRecord = {
      ...record,
      id: createId("pp"),
      titulo: `${record.titulo} (copia)`,
      createdAt: now,
      updatedAt: now,
    };
    void handleSavePaper(clone, "create");
  }

  function handleDuplicatePatent(record: PatentRecord) {
    const now = new Date().toISOString();
    const clone: PatentRecord = {
      ...record,
      id: createId("pt"),
      nombre: `${record.nombre} (copia)`,
      createdAt: now,
      updatedAt: now,
    };
    void handleSavePatent(clone, "create");
  }

  if (!session.loggedIn) {
    return <LoginScreen onLogin={(user) => setSession({ user, loggedIn: true })} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isSyncing ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
          Sincronizando datos...
        </div>
      ) : null}
      {syncError ? (
        <div className="fixed bottom-4 left-4 z-50 rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {syncError}
        </div>
      ) : null}
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col bg-slate-900 text-white md:flex">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">SciManage</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Plataforma</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          <button
            onClick={() => setView({ screen: "dashboard", selectedId: null })}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              view.screen === "dashboard" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </button>
          <button
            onClick={() => {
              setActiveKind("papers");
              setView({ screen: "records", selectedId: null });
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              (view.screen === "records" || view.screen === "detail") && activeKind === "papers"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <FileText className="h-5 w-5" /> Articulos / Papers
          </button>
          <button
            onClick={() => {
              setActiveKind("patents");
              setView({ screen: "records", selectedId: null });
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              (view.screen === "records" || view.screen === "detail") && activeKind === "patents"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <FileText className="h-5 w-5" /> Patentes
          </button>
          <button
            onClick={() => {
              setActiveKind("papers");
              setView({ screen: "report_papers", selectedId: null });
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              view.screen === "report_papers" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <ClipboardCopy className="h-5 w-5" /> Generar reporte de articulos/papers
          </button>
          <button
            onClick={() => {
              setActiveKind("patents");
              setView({ screen: "report_patents", selectedId: null });
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              view.screen === "report_patents" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <ClipboardCopy className="h-5 w-5" /> Generar reporte de patentes
          </button>
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-lg bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Usuario actual</p>
            <p className="text-sm font-medium">{session.user || "Administrador"}</p>
          </div>
          <Button variant="ghost" className="mt-3 w-full justify-center text-slate-300" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="p-6 md:ml-64 md:p-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              <BarChart3 className="h-4 w-4" /> {labels.badge}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              {view.screen === "dashboard"
                ? `Panel de ${labels.plural.toLowerCase()}`
                : view.screen === "records"
                  ? `Listado de ${labels.plural.toLowerCase()}`
                  : view.screen === "detail"
                    ? `Registro de ${labels.singular}`
                    : view.screen === "report_papers"
                      ? "Generar reporte de articulos/papers"
                      : "Generar reporte de patentes"}
            </h2>
            <p className="text-sm text-slate-500">Controla redaccion, envios y pagos desde un solo panel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view.screen !== "detail" && !isReport ? (
              <Button onClick={() => setView({ screen: "detail", selectedId: null })}>
                <PlusCircle className="h-4 w-4" /> Nuevo registro
              </Button>
            ) : null}
            {view.screen === "records" && activeKind === "papers" ? (
              <Button variant="outline" onClick={() => exportPaperCsv(filteredPapers)}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            ) : null}
            {view.screen === "records" && activeKind === "patents" ? (
              <Button variant="outline" onClick={() => exportPatentCsv(filteredPatents)}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            ) : null}
            {view.screen === "dashboard" ? (
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                <span className={activeKind === "papers" ? "text-slate-900" : "text-slate-400"}>Papers</span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={activeKind === "patents"}
                  onChange={(e) => {
                    setActiveKind(e.target.checked ? "patents" : "papers");
                    setView({ screen: "dashboard", selectedId: null });
                  }}
                />
                <span
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    activeKind === "patents" ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      activeKind === "patents" ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span className={activeKind === "patents" ? "text-slate-900" : "text-slate-400"}>Patentes</span>
              </label>
            ) : null}
          </div>
        </header>

        {activeKind === "papers" ? (
          <FiltersPanel filters={paperFilters} setFilters={setPaperFilters} sedeOptions={sedeOptions} />
        ) : (
          <PatentFiltersPanel
            filters={patentFilters}
            setFilters={setPatentFilters}
            sedeOptions={patentSedeOptions}
          />
        )}

        {view.screen === "dashboard" ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(activeKind === "papers"
                ? [
                    {
                      label: "Total papers",
                      value: computeKpis(filteredPapers).total,
                      icon: FileText,
                      color: "text-blue-600",
                      bg: "bg-blue-50",
                    },
                    {
                      label: "Finalizados",
                      value: computeKpis(filteredPapers).finalizados,
                      icon: CheckCircle2,
                      color: "text-emerald-600",
                      bg: "bg-emerald-50",
                    },
                    {
                      label: "En proceso",
                      value: computeKpis(filteredPapers).enProceso,
                      icon: PenTool,
                      color: "text-rose-600",
                      bg: "bg-rose-50",
                    },
                    {
                      label: "Integrantes",
                      value: filteredPapers.reduce((acc, curr) => acc + curr.integrantes, 0),
                      icon: Users,
                      color: "text-indigo-600",
                      bg: "bg-indigo-50",
                    },
                  ]
                : [
                    {
                      label: "Total patentes",
                      value: patentKpis.total,
                      icon: FileText,
                      color: "text-blue-600",
                      bg: "bg-blue-50",
                    },
                    {
                      label: "Inicio",
                      value: patentKpis.inicio,
                      icon: CheckCircle2,
                      color: "text-amber-600",
                      bg: "bg-amber-50",
                    },
                    {
                      label: "En proceso",
                      value: patentKpis.enProceso,
                      icon: PenTool,
                      color: "text-rose-600",
                      bg: "bg-rose-50",
                    },
                    {
                      label: "Finalizados",
                      value: patentKpis.finalizados,
                      icon: CheckCircle2,
                      color: "text-emerald-600",
                      bg: "bg-emerald-50",
                    },
                  ]
              ).map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className={`${item.bg} ${item.color} rounded-xl p-3`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                    <p className="text-2xl font-semibold">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {activeKind === "papers" ? (
                  <DashboardScreen records={filteredPapers} kind="papers" />
                ) : (
                  <PatentDashboardScreen records={filteredPatents} />
                )}
              </div>
              <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-300">
                  <PenTool className="h-5 w-5" /> Accesos rápidos
                </h3>
                <div className="mt-5 space-y-4">
                  {activeKind === "papers"
                    ? filteredPapers.slice(0, 4).map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/70 p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white line-clamp-1">{record.titulo}</p>
                            <p className="text-xs text-slate-400">
                              <Globe className="inline h-3 w-3 text-rose-400" /> {record.paisRevista}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setView({ screen: "detail", selectedId: record.id })}
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                        </div>
                      ))
                    : filteredPatents.slice(0, 4).map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/70 p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white line-clamp-1">{record.nombre}</p>
                            <p className="text-xs text-slate-400">
                              <Globe className="inline h-3 w-3 text-rose-400" /> {record.inventor}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setView({ screen: "detail", selectedId: record.id })}
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                        </div>
                      ))}
                  {(activeKind === "papers" ? filteredPapers.length : filteredPatents.length) === 0 ? (
                    <p className="text-xs text-slate-400">No hay registros para mostrar.</p>
                  ) : null}
                </div>
              </div>
            </div>
            {activeKind === "papers" ? (
              <Card className="border border-emerald-100">
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Insights de patentes</h3>
                      <p className="text-sm text-slate-500">Resumen rápido del portafolio de patentes.</p>
                    </div>
                    <Button variant="outline" onClick={() => setActiveKind("patents")}>
                      Ver dashboard de patentes
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <KpiCard label="Total patentes" value={patentKpis.total} helper="Registros activos" />
                    <KpiCard label="Inicio" value={patentKpis.inicio} helper="En etapa inicial" />
                    <KpiCard label="Finalizadas" value={patentKpis.finalizados} helper="Listas para cierre" />
                  </div>
                  <ChartCard title="Categorías" data={patentCategoryCounts} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {view.screen === "records" ? (
          <div className="mt-6">
            {activeKind === "papers" ? (
              <RecordsScreen
                records={filteredPapers}
                kind="papers"
                onNew={() => setView({ screen: "detail", selectedId: null })}
                onEdit={(id) => setView({ screen: "detail", selectedId: id })}
                onDelete={handleDeletePaper}
                onDuplicate={handleDuplicatePaper}
              />
            ) : (
              <PatentRecordsScreen
                records={filteredPatents}
                onNew={() => setView({ screen: "detail", selectedId: null })}
                onEdit={(id) => setView({ screen: "detail", selectedId: id })}
                onDelete={handleDeletePatent}
                onDuplicate={handleDuplicatePatent}
              />
            )}
          </div>
        ) : null}

        {view.screen === "detail" ? (
          <div className="mt-6">
            {activeKind === "papers" ? (
              <DetailScreen
                record={selectedPaper}
                kind="papers"
                onBack={() => setView({ screen: "records", selectedId: null })}
                onSave={handleSavePaper}
              />
            ) : (
              <PatentDetailScreen
                record={selectedPatent}
                onBack={() => setView({ screen: "records", selectedId: null })}
                onSave={handleSavePatent}
              />
            )}
          </div>
        ) : null}

        {view.screen === "report_papers" ? (
          <div className="mt-6">
            <ReportScreen records={filteredPapers} title="Reporte de articulos/papers" />
          </div>
        ) : null}

        {view.screen === "report_patents" ? (
          <div className="mt-6">
            <PatentReportScreen records={filteredPatents} title="Reporte de patentes" />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (user === "gestion@conocimiento.fablab" && password === "Gestion12345678") {
      onLogin(user);
      return;
    }
    setError("Credenciales invalidas.");
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto max-w-md">
        <Card className="rounded-[32px] border-0 shadow-soft">
          <CardContent className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                Login
              </div>
              <h1 className="mt-3 text-2xl font-semibold">Acceso de administración</h1>
              <p className="text-sm text-slate-500">
                Inicia sesión para gestionar el registro de papers y patentes.
              </p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500">Usuario</span>
                <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="usuario@dominio.com" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500">Contrasena</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
              {error ? (
                <Badge className="bg-rose-100 text-rose-700">{error}</Badge>
              ) : null}
              <Button className="w-full">Ingresar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  setFilters,
  sedeOptions,
}: {
  filters: { search: string; status: string; pagoStatus: string; sede: string };
  setFilters: React.Dispatch<
    React.SetStateAction<{ search: string; status: string; pagoStatus: string; sede: string }>
  >;
  sedeOptions: string[];
}) {
  return (
    <Card className="rounded-3xl border border-indigo-100 bg-indigo-50/60">
      <CardContent className="grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar título, sede o línea..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="todos">Status</option>
          <option value="en_proceso">En proceso</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <select
          className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
          value={filters.pagoStatus}
          onChange={(e) => setFilters({ ...filters, pagoStatus: e.target.value })}
        >
          <option value="todos">Pago</option>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <select
          className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
          value={filters.sede}
          onChange={(e) => setFilters({ ...filters, sede: e.target.value })}
        >
          <option value="todas">Sede</option>
          {sedeOptions.map((sede) => (
            <option key={sede} value={sede}>
              {sede}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}

function PatentFiltersPanel({
  filters,
  setFilters,
  sedeOptions,
}: {
  filters: { search: string; status: string; sede: string; categoria: string };
  setFilters: React.Dispatch<React.SetStateAction<{ search: string; status: string; sede: string; categoria: string }>>;
  sedeOptions: string[];
}) {
  return (
    <Card className="rounded-3xl border border-emerald-100 bg-emerald-50/60">
      <CardContent className="grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar patente, inventor o sede..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="todos">Status</option>
          <option value="inicio">Inicio</option>
          <option value="en_proceso">En proceso</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <select
          className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
          value={filters.categoria}
          onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
        >
          <option value="todas">Categoría</option>
          {PATENT_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
          value={filters.sede}
          onChange={(e) => setFilters({ ...filters, sede: e.target.value })}
        >
          <option value="todas">Sede</option>
          {sedeOptions.map((sede) => (
            <option key={sede} value={sede}>
              {sede}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}

function DashboardScreen({ records, kind }: { records: PaperRecord[]; kind: RecordKind }) {
  const kpis = useMemo(() => computeKpis(records), [records]);
  const statusCounts = useMemo(() => groupCountBy(records, (r) => r.status), [records]);
  const sedeCounts = useMemo(() => groupCountBy(records, (r) => r.sede), [records]);
  const montoPagadoPorSede = useMemo(() => groupPaidAmountBySede(records), [records]);
  const odsCount = useMemo(() => odsCounts(records), [records]);
  const lineaCounts = useMemo(() => groupCountBy(records, (r) => r.lineaInvestigacion), [records]);

  const odsRows = useMemo(() => {
    const entries = Object.entries(odsCount).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 6);
    const rest = entries.slice(6);
    const restTotal = rest.reduce((acc, [, value]) => acc + value, 0);
    if (restTotal > 0) top.push(["Otros", restTotal]);
    return top;
  }, [odsCount]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={`Total de ${RECORD_LABELS[kind].plural.toLowerCase()}`}
          value={kpis.total}
          helper="Registros activos"
        />
        <KpiCard label="En proceso" value={kpis.enProceso} helper="Necesitan seguimiento" />
        <KpiCard label="Finalizados" value={kpis.finalizados} helper="Listos para cierre" />
        <KpiCard label="% Finalizados" value={`${kpis.pctFinalizados}%`} helper="Finalizados / total" />
        <KpiCard label="Pagados" value={kpis.pagados} helper="Pagos confirmados" />
        <KpiCard label="Monto pagado" value={formatPen(kpis.montoPagadoPen)} helper="Suma de pagos confirmados" />
        <KpiCard label="Pendientes de pago" value={kpis.pendientes} helper="Por validar" />
        <KpiCard label="% Pagados" value={`${kpis.pctPagados}%`} helper="Pagados / total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Conteo por status" data={statusCounts} />
        <ChartCard title="Conteo por sede" data={sedeCounts} />
        <ChartCard title="Monto pagado por sede" data={montoPagadoPorSede} valueFormatter={formatPen} />
        <ChartCard title="Conteo por ODS" data={Object.fromEntries(odsRows)} />
        <ChartCard title="Líneas de investigación" data={lineaCounts} />
      </div>
    </div>
  );
}

function PatentDashboardScreen({ records }: { records: PatentRecord[] }) {
  const kpis = useMemo(() => computePatentKpis(records), [records]);
  const statusCounts = useMemo(() => groupCountBy(records, (r) => r.status), [records]);
  const sedeCounts = useMemo(() => groupCountBy(records, (r) => r.sede), [records]);
  const categoriaCounts = useMemo(() => groupCountBy(records, (r) => formatPatentCategory(r.categoria)), [records]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Total patentes" value={kpis.total} helper="Registros activos" />
        <KpiCard label="Inicio" value={kpis.inicio} helper="En etapa inicial" />
        <KpiCard label="En proceso" value={kpis.enProceso} helper="Necesitan seguimiento" />
        <KpiCard label="Finalizados" value={kpis.finalizados} helper="Listos para cierre" />
        <KpiCard label="% Finalizados" value={`${kpis.pctFinalizados}%`} helper="Finalizados / total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Conteo por status" data={statusCounts} />
        <ChartCard title="Conteo por sede" data={sedeCounts} />
        <ChartCard title="Categorías" data={categoriaCounts} />
      </div>
    </div>
  );
}

function RecordsScreen({
  records,
  kind,
  onNew,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  records: PaperRecord[];
  kind: RecordKind;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (record: PaperRecord) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Registros de {RECORD_LABELS[kind].plural.toLowerCase()}</h2>
          <p className="text-sm text-slate-500">{records.length} resultados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onNew}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Integrantes</th>
              <th className="px-3 py-2">Sede</th>
              <th className="px-3 py-2">ODS</th>
              <th className="px-3 py-2">Línea</th>
              <th className="px-3 py-2">Pais revista</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Revista</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2">Drive</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-indigo-50">
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-900">{record.titulo}</div>
                  <div className="text-xs text-slate-400">{formatDate(record.updatedAt)}</div>
                </td>
                <td className="px-3 py-3">{record.integrantes}</td>
                <td className="px-3 py-3">{record.sede}</td>
                <td className="px-3 py-3">{renderOdsBadges(record.ods)}</td>
                <td className="px-3 py-3">{record.lineaInvestigacion}</td>
                <td className="px-3 py-3">{record.paisRevista}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-3 py-3">
                  <LinkOut url={record.linkRevista} />
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <PayBadge status={record.pagoStatus} />
                    <div className="text-xs text-slate-500">
                      {record.pagoStatus === "pagado" ? formatPen(record.pagoMontoPen || 0) : "-"}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {record.pagoDriveUrl ? <LinkOut url={record.pagoDriveUrl} /> : "-"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(record.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDuplicate(record)}>
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(record.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-500">
                  Sin registros con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <Card key={record.id} className="border border-indigo-100">
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-semibold">{record.titulo}</div>
                <div className="text-xs text-slate-500">{record.lineaInvestigacion}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{record.sede}</span>
                <span>{record.paisRevista}</span>
                <span>{record.integrantes} integrantes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={record.status} />
                <PayBadge status={record.pagoStatus} />
                {record.pagoStatus === "pagado" ? <Badge className="bg-emerald-100 text-emerald-700">{formatPen(record.pagoMontoPen || 0)}</Badge> : null}
                {renderOdsBadges(record.ods)}
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkOut url={record.linkRevista} />
                {record.pagoDriveUrl ? <LinkOut url={record.pagoDriveUrl} /> : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(record.id)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDuplicate(record)}>
                  <ClipboardCopy className="h-4 w-4" /> Duplicar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(record.id)}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DetailScreen({
  record,
  kind,
  onBack,
  onSave,
}: {
  record: PaperRecord | null;
  kind: RecordKind;
  onBack: () => void;
  onSave: (record: PaperRecord, mode: "create" | "edit") => void;
}) {
  const [form, setForm] = useState<PaperRecord>(() => record || EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const labels = RECORD_LABELS[kind];

  React.useEffect(() => {
    setForm(record || EMPTY_FORM);
    setErrors({});
  }, [record]);

  function toggleOds(value: string) {
    setForm((prev) => {
      const exists = prev.ods.includes(value);
      return {
        ...prev,
        ods: exists ? prev.ods.filter((ods) => ods !== value) : [...prev.ods, value],
      };
    });
  }

  function handleLineaChange(value: string) {
    const nextOds = LINEA_ODS_MAP[value] ? [...LINEA_ODS_MAP[value]] : [];
    setForm((prev) => ({
      ...prev,
      lineaInvestigacion: value,
      ods: nextOds,
    }));
  }

  function validate(values: PaperRecord) {
    const next: Record<string, string> = {};
    if (!values.titulo.trim()) next.titulo = "El título es obligatorio.";
    if (values.integrantes < 1) next.integrantes = "Integrantes debe ser >= 1.";
    if (!values.sede.trim()) next.sede = "La sede es obligatoria.";
    if (!values.lineaInvestigacion.trim()) next.lineaInvestigacion = "Línea requerida.";
    if (!values.paisRevista.trim()) next.paisRevista = "Pais requerido.";
    if (!values.linkRevista.trim() || !isValidUrl(values.linkRevista)) {
      next.linkRevista = "El link debe ser una URL valida.";
    }
    const driveUrl = values.pagoDriveUrl.trim();
    if (values.pagoStatus === "pagado" && !driveUrl) {
      next.pagoDriveUrl = "URL de Drive obligatoria si está pagado.";
    } else if (driveUrl && !isValidUrl(driveUrl)) {
      next.pagoDriveUrl = "La URL de Drive no es valida.";
    }
    if (values.pagoStatus === "pagado" && (!Number.isFinite(Number(values.pagoMontoPen)) || Number(values.pagoMontoPen) < 0)) {
      next.pagoMontoPen = "Ingresa un monto válido en soles.";
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const now = new Date().toISOString();
    const payload: PaperRecord = {
      ...form,
      id: form.id || createId(kind === "papers" ? "pp" : "pt"),
      pagoDriveUrl: form.pagoDriveUrl.trim(),
      pagoMontoPen: form.pagoStatus === "pagado" ? Math.max(0, Number(form.pagoMontoPen || 0)) : 0,
      createdAt: form.createdAt || now,
      updatedAt: now,
    };

    onSave(payload, record ? "edit" : "create");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{record ? "Editar registro" : "Nuevo registro"}</h2>
          <p className="text-sm text-slate-500">Completa todos los campos obligatorios.</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
      </div>

      <Card className="border border-indigo-100">
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field label={`Título de ${labels.singular}`} error={errors.titulo}>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </Field>
            <Field label="Integrantes (# alumnos)" error={errors.integrantes}>
              <Input
                type="number"
                min={1}
                value={form.integrantes}
                onChange={(e) => setForm({ ...form, integrantes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Sede" error={errors.sede}>
              <select
                className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
                value={form.sede}
                onChange={(e) => setForm({ ...form, sede: e.target.value })}
              >
                <option value="">Selecciona una sede</option>
                {SEDES.map((sede) => (
                  <option key={sede} value={sede}>
                    {sede}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Línea de investigación" error={errors.lineaInvestigacion}>
              <select
                className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
                value={form.lineaInvestigacion}
                onChange={(e) => handleLineaChange(e.target.value)}
              >
                <option value="">Selecciona una línea</option>
                {!LINEA_OPTIONS.includes(form.lineaInvestigacion) && form.lineaInvestigacion ? (
                  <option value={form.lineaInvestigacion}>{form.lineaInvestigacion}</option>
                ) : null}
                {LINEA_OPTIONS.map((linea) => (
                  <option key={linea} value={linea}>
                    {linea}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pais de revista" error={errors.paisRevista}>
              <Input
                value={form.paisRevista}
                onChange={(e) => setForm({ ...form, paisRevista: e.target.value })}
              />
            </Field>
            <Field label="Link de revista" error={errors.linkRevista}>
              <Input
                value={form.linkRevista}
                onChange={(e) => setForm({ ...form, linkRevista: e.target.value })}
                placeholder="https://..."
              />
            </Field>

            <div className="md:col-span-2">
              <span className="text-xs font-semibold text-slate-500">ODS</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ODS_OPTIONS.map((ods) => (
                  <label key={ods} className="flex items-center gap-2 rounded-full border border-indigo-200 px-3 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={form.ods.includes(ods)}
                      onChange={() => toggleOds(ods)}
                    />
                    {ods}
                  </label>
                ))}
              </div>
            </div>

            <Field label="Status">
              <select
                className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PaperStatus })}
              >
                <option value="en_proceso">En proceso</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </Field>

            <Field label="Status de pago">
              <select
                className="h-10 rounded-xl border border-indigo-200 bg-white px-3 text-sm text-slate-700"
                value={form.pagoStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pagoStatus: e.target.value as PayStatus,
                    pagoMontoPen: e.target.value === "pagado" ? form.pagoMontoPen : 0,
                  })
                }
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </Field>

            <Field label="Monto pagado (PEN / S/)" error={errors.pagoMontoPen}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.pagoMontoPen}
                onChange={(e) => setForm({ ...form, pagoMontoPen: Number(e.target.value) })}
                placeholder="0.00"
                disabled={form.pagoStatus !== "pagado"}
              />
            </Field>

            <Field label="URL de Drive (pruebas de pago)" error={errors.pagoDriveUrl}>
              <Input
                value={form.pagoDriveUrl}
                onChange={(e) => setForm({ ...form, pagoDriveUrl: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </Field>

            <Field label="Notas internas">
              <Textarea placeholder="Notas opcionales..." />
            </Field>

            <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={onBack}>
                Volver
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PatentDetailScreen({
  record,
  onBack,
  onSave,
}: {
  record: PatentRecord | null;
  onBack: () => void;
  onSave: (record: PatentRecord, mode: "create" | "edit") => void;
}) {
  const [form, setForm] = useState<PatentRecord>(() => record || EMPTY_PATENT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    setForm(record || EMPTY_PATENT);
    setErrors({});
  }, [record]);

  function validate(values: PatentRecord) {
    const next: Record<string, string> = {};
    if (!values.nombre.trim()) next.nombre = "El nombre de la patente es obligatorio.";
    if (!values.inventor.trim()) next.inventor = "El inventor es obligatorio.";
    if (!values.sede.trim()) next.sede = "La sede es obligatoria.";
    if (!values.categoria) next.categoria = "La categoría es obligatoria.";
    if (!values.status) next.status = "El status es obligatorio.";
    if (values.link && !isValidUrl(values.link)) next.link = "El link debe ser una URL valida.";
    if (!values.numeroExpediente.trim()) next.numeroExpediente = "El número de expediente es obligatorio.";
    if (!values.fechaSolicitud.trim()) next.fechaSolicitud = "La fecha de solicitud es obligatoria.";
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const now = new Date().toISOString();
    const payload: PatentRecord = {
      ...form,
      id: form.id || createId("pt"),
      createdAt: form.createdAt || now,
      updatedAt: now,
    };

    onSave(payload, record ? "edit" : "create");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{record ? "Editar patente" : "Nueva patente"}</h2>
          <p className="text-sm text-slate-500">Completa todos los campos obligatorios.</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
      </div>

      <Card className="border border-emerald-100">
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field label="Nombre de patente" error={errors.nombre}>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Field>
            <Field label="Inventor" error={errors.inventor}>
              <Input value={form.inventor} onChange={(e) => setForm({ ...form, inventor: e.target.value })} />
            </Field>
            <Field label="Sede" error={errors.sede}>
              <select
                className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
                value={form.sede}
                onChange={(e) => setForm({ ...form, sede: e.target.value })}
              >
                <option value="">Selecciona una sede</option>
                {PATENT_SEDES.map((sede) => (
                  <option key={sede} value={sede}>
                    {sede}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría" error={errors.categoria}>
              <select
                className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as PatentCategory })}
              >
                {PATENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" error={errors.status}>
              <select
                className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-700"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PatentStatus })}
              >
                <option value="inicio">Inicio</option>
                <option value="en_proceso">En proceso</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </Field>
            <Field label="Número de expediente" error={errors.numeroExpediente}>
              <Input
                value={form.numeroExpediente}
                onChange={(e) => setForm({ ...form, numeroExpediente: e.target.value })}
              />
            </Field>
            <Field label="Fecha de solicitud" error={errors.fechaSolicitud}>
              <Input
                type="date"
                value={form.fechaSolicitud}
                onChange={(e) => setForm({ ...form, fechaSolicitud: e.target.value })}
              />
            </Field>
            <Field label="Link" error={errors.link}>
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Notas internas">
              <Textarea placeholder="Notas opcionales..." />
            </Field>

            <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={onBack}>
                Volver
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PatentRecordsScreen({
  records,
  onNew,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  records: PatentRecord[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (record: PatentRecord) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Registros de patentes</h2>
          <p className="text-sm text-slate-500">{records.length} resultados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onNew}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Inventor</th>
              <th className="px-3 py-2">Sede</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Expediente</th>
              <th className="px-3 py-2">Solicitud</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-emerald-50">
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-900">{record.nombre}</div>
                  <div className="text-xs text-slate-400">{formatDate(record.updatedAt)}</div>
                </td>
                <td className="px-3 py-3">{record.inventor}</td>
                <td className="px-3 py-3">{record.sede}</td>
                <td className="px-3 py-3">{formatPatentCategory(record.categoria)}</td>
                <td className="px-3 py-3">
                  <PatentStatusBadge status={record.status} />
                </td>
                <td className="px-3 py-3">{record.numeroExpediente || "-"}</td>
                <td className="px-3 py-3">{record.fechaSolicitud || "-"}</td>
                <td className="px-3 py-3">{record.link ? <LinkOut url={record.link} /> : "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(record.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDuplicate(record)}>
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(record.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                  Sin registros con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <Card key={record.id} className="border border-emerald-100">
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-semibold">{record.nombre}</div>
                <div className="text-xs text-slate-500">{record.inventor}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{record.sede}</span>
                <span>{formatPatentCategory(record.categoria)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <PatentStatusBadge status={record.status} />
              </div>
              <div className="flex flex-wrap gap-2">{record.link ? <LinkOut url={record.link} /> : null}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(record.id)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDuplicate(record)}>
                  <ClipboardCopy className="h-4 w-4" /> Duplicar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(record.id)}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function KpiCard({ label, value, helper }: { label: string; value: React.ReactNode; helper: string }) {
  return (
    <Card className="border border-indigo-100">
      <CardContent className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</div>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{helper}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  data,
  valueFormatter = (value) => String(value),
}: {
  title: string;
  data: Record<string, number>;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <Card className="border border-indigo-100">
      <CardContent className="space-y-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="space-y-2">
          {Object.entries(data).map(([label, value]) => (
            <div key={label} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-20 truncate">{label}</span>
              <div className="h-2 flex-1 rounded-full bg-indigo-100">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.round((value / max) * 100)}%` }}
                />
              </div>
              <span className="w-24 text-right text-slate-600">{valueFormatter(value)}</span>
            </div>
          ))}
          {Object.keys(data).length === 0 ? (
            <div className="text-xs text-slate-400">Sin datos para mostrar.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: PaperStatus }) {
  return (
    <Badge className={status === "finalizado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
      {status === "finalizado" ? "Finalizado" : "En proceso"}
    </Badge>
  );
}

function PatentStatusBadge({ status }: { status: PatentStatus }) {
  const styles =
    status === "finalizado"
      ? "bg-emerald-100 text-emerald-700"
      : status === "en_proceso"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-200 text-slate-700";
  const label = status === "finalizado" ? "Finalizado" : status === "en_proceso" ? "En proceso" : "Inicio";
  return <Badge className={styles}>{label}</Badge>;
}

function PayBadge({ status }: { status: PayStatus }) {
  return (
    <Badge className={status === "pagado" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}>
      {status === "pagado" ? "Pagado" : "Pendiente"}
    </Badge>
  );
}

function LinkOut({ url }: { url: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <LinkIcon className="h-3 w-3" />
      Link
    </a>
  );
}

function renderOdsBadges(ods: string[]) {
  if (!ods.length) return <Badge className="bg-slate-100 text-slate-600">Sin ODS</Badge>;
  const visible = ods.slice(0, 2);
  const rest = ods.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((item) => (
        <Badge key={item} className="bg-indigo-100 text-indigo-700">
          {item}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge className="bg-slate-100 text-slate-600">+{rest}</Badge>
      ) : null}
    </div>
  );
}

function formatPatentCategory(value: PatentCategory) {
  const match = PATENT_CATEGORIES.find((cat) => cat.value === value);
  return match ? match.label : value;
}

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#0ea5e9",
  "#f97316",
  "#10b981",
];

function PieChartCard({
  title,
  data,
  valueFormatter = (value) => String(value),
}: {
  title: string;
  data: Record<string, number>;
  valueFormatter?: (value: number) => string;
}) {
  const entries = Object.entries(data);
  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card className="border border-indigo-100">
      <CardContent className="space-y-3">
        <div className="text-sm font-semibold">{title}</div>
        {total === 0 ? (
          <div className="text-xs text-slate-400">Sin datos para mostrar.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[140px_1fr] md:items-center">
            <svg viewBox="0 0 120 120" className="mx-auto h-32 w-32">
              <g transform="rotate(-90 60 60)">
                {entries.map(([label, value], index) => {
                  const fraction = value / total;
                  const dash = fraction * circumference;
                  const gap = circumference - dash;
                  const stroke = PIE_COLORS[index % PIE_COLORS.length];
                  const dashOffset = -offset;
                  offset += dash;
                  return (
                    <circle
                      key={label}
                      r={radius}
                      cx="60"
                      cy="60"
                      fill="none"
                      stroke={stroke}
                      strokeWidth={18}
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset={dashOffset}
                    />
                  );
                })}
              </g>
              <circle r="34" cx="60" cy="60" fill="#fff" />
              <text x="60" y="64" textAnchor="middle" className="fill-slate-900 text-xs font-semibold">
                {valueFormatter(total)}
              </text>
            </svg>
            <div className="space-y-2 text-xs text-slate-600">
              {entries.map(([label, value], index) => {
                const pct = Math.round((value / total) * 100);
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{label || "Sin dato"}</span>
                    <span className="font-semibold text-slate-900">{valueFormatter(value)}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function exportPaperCsv(records: PaperRecord[]) {
  const header = [
    "id",
    "titulo",
    "integrantes",
    "sede",
    "ods",
    "lineaInvestigacion",
    "paisRevista",
    "status",
    "linkRevista",
    "pagoStatus",
    "pagoMontoPen",
    "pagoDriveUrl",
    "createdAt",
    "updatedAt",
  ];
  const rows = records.map((r) => [
    r.id,
    r.titulo,
    r.integrantes,
    r.sede,
    r.ods.join("|"),
    r.lineaInvestigacion,
    r.paisRevista,
    r.status,
    r.linkRevista,
    r.pagoStatus,
    r.pagoMontoPen,
    r.pagoDriveUrl,
    r.createdAt,
    r.updatedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "papers.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportPatentCsv(records: PatentRecord[]) {
  const header = [
    "id",
    "nombre",
    "inventor",
    "sede",
    "categoria",
    "status",
    "numeroExpediente",
    "fechaSolicitud",
    "link",
    "createdAt",
    "updatedAt",
  ];
  const rows = records.map((r) => [
    r.id,
    r.nombre,
    r.inventor,
    r.sede,
    r.categoria,
    r.status,
    r.numeroExpediente,
    r.fechaSolicitud,
    r.link,
    r.createdAt,
    r.updatedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "patentes.csv";
  link.click();
  URL.revokeObjectURL(url);
}

type ReportField = {
  key: keyof PaperRecord;
  label: string;
};

const REPORT_FIELDS: ReportField[] = [
  { key: "titulo", label: "Título" },
  { key: "integrantes", label: "Integrantes" },
  { key: "sede", label: "Sede" },
  { key: "ods", label: "ODS" },
  { key: "lineaInvestigacion", label: "Línea" },
  { key: "paisRevista", label: "Pais revista" },
  { key: "status", label: "Status" },
  { key: "pagoStatus", label: "Pago" },
  { key: "pagoMontoPen", label: "Monto pago (PEN)" },
  { key: "linkRevista", label: "Link revista" },
  { key: "pagoDriveUrl", label: "Link pago" },
  { key: "createdAt", label: "Creado" },
  { key: "updatedAt", label: "Actualizado" },
];

type PatentReportField = {
  key: keyof PatentRecord;
  label: string;
};

const PATENT_REPORT_FIELDS: PatentReportField[] = [
  { key: "nombre", label: "Nombre" },
  { key: "inventor", label: "Inventor" },
  { key: "sede", label: "Sede" },
  { key: "categoria", label: "Categoría" },
  { key: "status", label: "Status" },
  { key: "numeroExpediente", label: "Expediente" },
  { key: "fechaSolicitud", label: "Fecha solicitud" },
  { key: "link", label: "Link" },
  { key: "createdAt", label: "Creado" },
  { key: "updatedAt", label: "Actualizado" },
];

type ReportChart = {
  title: string;
  data: Record<string, number>;
  valueFormatter?: (value: number) => string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReportHtml({
  records,
  columns,
  generatedAt,
  charts,
  title,
}: {
  records: PaperRecord[];
  columns: ReportField[];
  generatedAt: string;
  charts: ReportChart[];
  title: string;
}) {
  const pieColors = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#7c3aed",
    "#0ea5e9",
    "#f97316",
    "#10b981",
  ];
  const chartHtml = charts
    .map((chart) => {
      const entries = Object.entries(chart.data);
      const total = entries.reduce((acc, [, value]) => acc + value, 0);
      const max = Math.max(1, ...entries.map(([, value]) => value));
      const valueFormatter = chart.valueFormatter || ((value: number) => String(value));
      const rows = entries
        .map(([label, value]) => {
          const pct = Math.round((value / max) * 100);
          return `
            <div class="chart-row">
              <div class="chart-label">${escapeHtml(label || "Sin dato")}</div>
              <div class="chart-bar">
                <div class="chart-fill" style="width:${pct}%"></div>
              </div>
              <div class="chart-value">${escapeHtml(valueFormatter(value))}</div>
            </div>
          `;
        })
        .join("");
      const legend = entries
        .map(([label, value], index) => {
          const pct = total ? Math.round((value / total) * 100) : 0;
          return `
            <div class="legend-row">
              <span class="legend-dot" style="background:${pieColors[index % pieColors.length]}"></span>
              <span class="legend-label">${escapeHtml(label || "Sin dato")}</span>
              <span class="legend-value">${escapeHtml(valueFormatter(value))}</span>
              <span class="legend-pct">${pct}%</span>
            </div>
          `;
        })
        .join("");
      let currentOffset = 0;
      const pieSlices = entries
        .map(([, value], index) => {
          const pct = total ? value / total : 0;
          const radius = 52;
          const circumference = 2 * Math.PI * radius;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const slice = `
            <circle
              class="pie-slice"
              r="${radius}"
              cx="60"
              cy="60"
              stroke="${pieColors[index % pieColors.length]}"
              stroke-dasharray="${dash} ${gap}"
              stroke-dashoffset="-${currentOffset}"
              data-index="${index}"
            ></circle>
          `;
          currentOffset += dash;
          return slice;
        })
        .join("");
      const pieSvg = total
        ? `
        <svg class="pie-svg" viewBox="0 0 120 120">
          <g transform="rotate(-90 60 60)">
            ${pieSlices}
          </g>
          <circle class="pie-hole" r="34" cx="60" cy="60"></circle>
          <text x="60" y="64" text-anchor="middle" class="pie-total">${escapeHtml(valueFormatter(total))}</text>
        </svg>
      `
        : `<div class="chart-empty">Sin datos para mostrar.</div>`;
      return `
        <div class="chart-card">
          <div class="chart-title">${escapeHtml(chart.title)}</div>
          ${
            total > 0
              ? `
          <div class="chart-grid">
            <div class="pie">
              ${pieSvg}
            </div>
            <div class="legend">
              ${legend}
            </div>
          </div>
          `
              : `<div class="chart-empty">Sin datos para mostrar.</div>`
          }
          <div class="chart-bars">${rows || `<div class="chart-empty">Sin datos para mostrar.</div>`}</div>
        </div>
      `;
    })
    .join("");

  const headerCells = columns
    .map((col) => `<th>${escapeHtml(col.label)}</th>`)
    .join("");

  const rowsHtml = records
    .map((record) => {
      const cells = columns
        .map((col) => {
          const raw = record[col.key];
          const value =
            col.key === "ods"
              ? record.ods.join(", ")
              : col.key === "pagoMontoPen"
                ? formatPen(record.pagoMontoPen || 0)
              : col.key === "createdAt" || col.key === "updatedAt"
                ? formatDate(String(raw))
                : String(raw || "-");
          return `<td>${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const bodyRows =
    records.length > 0
      ? rowsHtml
      : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No hay datos para el reporte.</td></tr>`;

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} - SciManage</title>
    <style>
      * { box-sizing: border-box; }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        font-family: "Segoe UI", "Inter", Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 36px;
        background: #eef2ff;
      }
      .report {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 28px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #2563eb;
        color: white;
        font-size: 10px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .header h1 {
        margin: 0;
        font-size: 20px;
      }
      .meta {
        font-size: 12px;
        color: #64748b;
      }
      .kpi {
        font-size: 12px;
        color: #64748b;
      }
      .charts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin: 16px 0 20px;
      }
      .chart-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        background: #f8fafc;
      }
      .chart-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: #334155;
        margin-bottom: 8px;
      }
      .chart-grid {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }
      .pie {
        width: 120px;
        height: 120px;
        display: grid;
        place-items: center;
        position: relative;
      }
      .pie-svg {
        width: 120px;
        height: 120px;
      }
      .pie-slice {
        fill: none;
        stroke-width: 18;
        stroke-linecap: butt;
      }
      .pie-hole {
        fill: #ffffff;
      }
      .pie-total {
        font-size: 12px;
        font-weight: 700;
        fill: #0f172a;
      }
      .legend {
        display: grid;
        gap: 6px;
      }
      .legend-row {
        display: grid;
        grid-template-columns: 10px 1fr auto auto;
        gap: 6px;
        align-items: center;
        font-size: 11px;
        color: #475569;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .legend-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .legend-value {
        font-weight: 600;
        color: #0f172a;
      }
      .legend-pct {
        color: #94a3b8;
      }
      .chart-bars {
        margin-top: 6px;
      }
      .chart-row {
        display: grid;
        grid-template-columns: 120px 1fr 32px;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        margin-bottom: 6px;
      }
      .chart-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #475569;
      }
      .chart-bar {
        height: 6px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
      }
      .chart-fill {
        height: 6px;
        background: #2563eb;
        border-radius: 999px;
      }
      .chart-value {
        text-align: right;
        font-weight: 600;
        color: #0f172a;
      }
      .chart-empty {
        font-size: 11px;
        color: #94a3b8;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      thead th {
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
        padding: 8px;
        border-bottom: 1px solid #e2e8f0;
      }
      tbody td {
        padding: 8px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }
      .empty {
        text-align: center;
        color: #94a3b8;
        padding: 16px;
      }
      @media print {
        @page { size: A4; margin: 14mm; }
        body { background: #ffffff; padding: 0; }
        .report { border: none; border-radius: 0; padding: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="report">
      <div class="header">
        <div>
          <div class="brand">Scimanage</div>
          <h1>${escapeHtml(title)} - SciManage</h1>
          <div class="meta">Generado el ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="kpi">Total registros: ${records.length}</div>
      </div>
      <div class="charts">
        ${chartHtml}
      </div>
      <table>
        <thead>
          <tr>${headerCells || "<th>Sin columnas</th>"}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  </body>
</html>
  `;
}

function buildPatentReportHtml({
  records,
  columns,
  generatedAt,
  charts,
  title,
}: {
  records: PatentRecord[];
  columns: PatentReportField[];
  generatedAt: string;
  charts: ReportChart[];
  title: string;
}) {
  const pieColors = [
    "#059669",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#7c3aed",
    "#0ea5e9",
    "#f97316",
    "#10b981",
  ];
  const chartHtml = charts
    .map((chart) => {
      const entries = Object.entries(chart.data);
      const total = entries.reduce((acc, [, value]) => acc + value, 0);
      const max = Math.max(1, ...entries.map(([, value]) => value));
      const rows = entries
        .map(([label, value]) => {
          const pct = Math.round((value / max) * 100);
          return `
            <div class="chart-row">
              <div class="chart-label">${escapeHtml(label || "Sin dato")}</div>
              <div class="chart-bar">
                <div class="chart-fill" style="width:${pct}%"></div>
              </div>
              <div class="chart-value">${value}</div>
            </div>
          `;
        })
        .join("");
      const legend = entries
        .map(([label, value], index) => {
          const pct = total ? Math.round((value / total) * 100) : 0;
          return `
            <div class="legend-row">
              <span class="legend-dot" style="background:${pieColors[index % pieColors.length]}"></span>
              <span class="legend-label">${escapeHtml(label || "Sin dato")}</span>
              <span class="legend-value">${value}</span>
              <span class="legend-pct">${pct}%</span>
            </div>
          `;
        })
        .join("");
      let currentOffset = 0;
      const pieSlices = entries
        .map(([, value], index) => {
          const pct = total ? value / total : 0;
          const radius = 52;
          const circumference = 2 * Math.PI * radius;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const slice = `
            <circle
              class="pie-slice"
              r="${radius}"
              cx="60"
              cy="60"
              stroke="${pieColors[index % pieColors.length]}"
              stroke-dasharray="${dash} ${gap}"
              stroke-dashoffset="-${currentOffset}"
              data-index="${index}"
            ></circle>
          `;
          currentOffset += dash;
          return slice;
        })
        .join("");
      const pieSvg = total
        ? `
        <svg class="pie-svg" viewBox="0 0 120 120">
          <g transform="rotate(-90 60 60)">
            ${pieSlices}
          </g>
          <circle class="pie-hole" r="34" cx="60" cy="60"></circle>
          <text x="60" y="64" text-anchor="middle" class="pie-total">${total}</text>
        </svg>
      `
        : `<div class="chart-empty">Sin datos para mostrar.</div>`;
      return `
        <div class="chart-card">
          <div class="chart-title">${escapeHtml(chart.title)}</div>
          ${
            total > 0
              ? `
          <div class="chart-grid">
            <div class="pie">
              ${pieSvg}
            </div>
            <div class="legend">
              ${legend}
            </div>
          </div>
          `
              : `<div class="chart-empty">Sin datos para mostrar.</div>`
          }
          <div class="chart-bars">${rows || `<div class="chart-empty">Sin datos para mostrar.</div>`}</div>
        </div>
      `;
    })
    .join("");

  const headerCells = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");

  const rowsHtml = records
    .map((record) => {
      const cells = columns
        .map((col) => {
          const raw = record[col.key];
          const value =
            col.key === "categoria"
              ? formatPatentCategory(String(raw) as PatentCategory)
              : col.key === "createdAt" || col.key === "updatedAt"
                ? formatDate(String(raw))
                : String(raw || "-");
          return `<td>${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const bodyRows =
    records.length > 0
      ? rowsHtml
      : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No hay datos para el reporte.</td></tr>`;

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} - SciManage</title>
    <style>
      * { box-sizing: border-box; }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        font-family: "Segoe UI", "Inter", Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 36px;
        background: #ecfdf5;
      }
      .report {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 28px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #059669;
        color: white;
        font-size: 10px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .header h1 {
        margin: 0;
        font-size: 20px;
      }
      .meta {
        font-size: 12px;
        color: #64748b;
      }
      .kpi {
        font-size: 12px;
        color: #64748b;
      }
      .charts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin: 16px 0 20px;
      }
      .chart-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        background: #f8fafc;
      }
      .chart-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: #334155;
        margin-bottom: 8px;
      }
      .chart-grid {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }
      .pie {
        width: 120px;
        height: 120px;
        display: grid;
        place-items: center;
        position: relative;
      }
      .pie-svg {
        width: 120px;
        height: 120px;
      }
      .pie-slice {
        fill: none;
        stroke-width: 18;
        stroke-linecap: butt;
      }
      .pie-hole {
        fill: #ffffff;
      }
      .pie-total {
        font-size: 12px;
        font-weight: 700;
        fill: #0f172a;
      }
      .legend {
        display: grid;
        gap: 6px;
      }
      .legend-row {
        display: grid;
        grid-template-columns: 10px 1fr auto auto;
        gap: 6px;
        align-items: center;
        font-size: 11px;
        color: #475569;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .legend-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .legend-value {
        font-weight: 600;
        color: #0f172a;
      }
      .legend-pct {
        color: #94a3b8;
      }
      .chart-bars {
        margin-top: 6px;
      }
      .chart-row {
        display: grid;
        grid-template-columns: 120px 1fr 32px;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        margin-bottom: 6px;
      }
      .chart-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #475569;
      }
      .chart-bar {
        height: 6px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
      }
      .chart-fill {
        height: 6px;
        background: #059669;
        border-radius: 999px;
      }
      .chart-value {
        text-align: right;
        font-weight: 600;
        color: #0f172a;
      }
      .chart-empty {
        font-size: 11px;
        color: #94a3b8;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      thead th {
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
        padding: 8px;
        border-bottom: 1px solid #e2e8f0;
      }
      tbody td {
        padding: 8px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }
      .empty {
        text-align: center;
        color: #94a3b8;
        padding: 16px;
      }
      @media print {
        @page { size: A4; margin: 14mm; }
        body { background: #ffffff; padding: 0; }
        .report { border: none; border-radius: 0; padding: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="report">
      <div class="header">
        <div>
          <div class="brand">Scimanage</div>
          <h1>${escapeHtml(title)} - SciManage</h1>
          <div class="meta">Generado el ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="kpi">Total registros: ${records.length}</div>
      </div>
      <div class="charts">
        ${chartHtml}
      </div>
      <table>
        <thead>
          <tr>${headerCells || "<th>Sin columnas</th>"}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  </body>
</html>
  `;
}

function ReportScreen({ records, title }: { records: PaperRecord[]; title: string }) {
  const [selectedFields, setSelectedFields] = useState<Set<keyof PaperRecord>>(
    () => new Set(REPORT_FIELDS.map((f) => f.key))
  );
  const statusCounts = useMemo(() => groupCountBy(records, (r) => r.status), [records]);
  const sedeCounts = useMemo(() => groupCountBy(records, (r) => r.sede), [records]);
  const pagoCounts = useMemo(() => groupCountBy(records, (r) => r.pagoStatus), [records]);
  const montoPagadoPorSede = useMemo(() => groupPaidAmountBySede(records), [records]);
  const odsCount = useMemo(() => odsCounts(records), [records]);

  function toggleField(key: keyof PaperRecord) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedFields(new Set(REPORT_FIELDS.map((f) => f.key)));
  }

  function clearAll() {
    setSelectedFields(new Set());
  }

  function printReport() {
    const columns = REPORT_FIELDS.filter((f) => selectedFields.has(f.key));
    const html = buildReportHtml({
      records,
      columns,
      generatedAt: new Date().toLocaleString(),
      charts: [
        { title: "Status", data: statusCounts },
        { title: "Pago", data: pagoCounts },
        { title: "Monto pagado por sede", data: montoPagadoPorSede, valueFormatter: formatPen },
        { title: "Sede", data: sedeCounts },
        { title: "ODS", data: odsCount },
      ],
      title,
    });
    const reportWindow = window.open("", "_blank", "width=1200,height=800");
    if (!reportWindow) {
      window.alert("El navegador bloqueo la ventana de impresion.");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.onload = () => {
      reportWindow.print();
    };
    reportWindow.onafterprint = () => {
      reportWindow.close();
    };
  }

  const columns = REPORT_FIELDS.filter((f) => selectedFields.has(f.key));
  const charts = [
    { title: "Status", data: statusCounts },
    { title: "Pago", data: pagoCounts },
    { title: "Monto pagado por sede", data: montoPagadoPorSede, valueFormatter: formatPen },
    { title: "Sede", data: sedeCounts },
    { title: "ODS", data: odsCount },
  ];

  return (
    <Card className="border border-indigo-100">
      <CardContent className="space-y-5">
        <div className="no-print flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Selecciona categorías</h3>
            <p className="text-sm text-slate-500">El reporte se imprime como PDF desde el dialogo de impresion.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAll}>
              Seleccionar todo
            </Button>
            <Button variant="outline" onClick={clearAll}>
              Limpiar
            </Button>
            <Button onClick={printReport} disabled={columns.length === 0}>
              Imprimir PDF
            </Button>
          </div>
        </div>

        <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedFields.has(field.key)}
                onChange={() => toggleField(field.key)}
              />
              {field.label}
            </label>
          ))}
        </div>

        <div className="print-area space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
              <p className="text-xs text-slate-500">
                Generado el {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="text-xs text-slate-400">Total: {records.length}</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {charts.map((chart) => (
              <PieChartCard key={chart.title} title={chart.title} data={chart.data} valueFormatter={chart.valueFormatter} />
            ))}
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left uppercase text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-2 py-2">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    {columns.map((col) => {
                      const value = record[col.key];
                      const display =
                        col.key === "ods"
                          ? record.ods.join(", ")
                          : col.key === "pagoMontoPen"
                            ? formatPen(record.pagoMontoPen || 0)
                          : col.key === "createdAt" || col.key === "updatedAt"
                            ? formatDate(String(value))
                            : String(value || "-");
                      return (
                        <td key={col.key} className="px-2 py-2 text-slate-700">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length || 1} className="px-2 py-6 text-center text-slate-400">
                      No hay datos para el reporte.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatentReportScreen({ records, title }: { records: PatentRecord[]; title: string }) {
  const [selectedFields, setSelectedFields] = useState<Set<keyof PatentRecord>>(
    () => new Set(PATENT_REPORT_FIELDS.map((f) => f.key))
  );
  const statusCounts = useMemo(() => groupCountBy(records, (r) => r.status), [records]);
  const sedeCounts = useMemo(() => groupCountBy(records, (r) => r.sede), [records]);
  const categoriaCounts = useMemo(() => groupCountBy(records, (r) => formatPatentCategory(r.categoria)), [records]);

  function toggleField(key: keyof PatentRecord) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedFields(new Set(PATENT_REPORT_FIELDS.map((f) => f.key)));
  }

  function clearAll() {
    setSelectedFields(new Set());
  }

  function printReport() {
    const columns = PATENT_REPORT_FIELDS.filter((f) => selectedFields.has(f.key));
    const html = buildPatentReportHtml({
      records,
      columns,
      generatedAt: new Date().toLocaleString(),
      charts: [
        { title: "Status", data: statusCounts },
        { title: "Categoría", data: categoriaCounts },
        { title: "Sede", data: sedeCounts },
      ],
      title,
    });
    const reportWindow = window.open("", "_blank", "width=1200,height=800");
    if (!reportWindow) {
      window.alert("El navegador bloqueo la ventana de impresion.");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.onload = () => {
      reportWindow.print();
    };
    reportWindow.onafterprint = () => {
      reportWindow.close();
    };
  }

  const columns = PATENT_REPORT_FIELDS.filter((f) => selectedFields.has(f.key));
  const charts = [
    { title: "Status", data: statusCounts },
    { title: "Categoría", data: categoriaCounts },
    { title: "Sede", data: sedeCounts },
  ];

  return (
    <Card className="border border-emerald-100">
      <CardContent className="space-y-5">
        <div className="no-print flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Selecciona categorías</h3>
            <p className="text-sm text-slate-500">El reporte se imprime como PDF desde el dialogo de impresion.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAll}>
              Seleccionar todo
            </Button>
            <Button variant="outline" onClick={clearAll}>
              Limpiar
            </Button>
            <Button onClick={printReport} disabled={columns.length === 0}>
              Imprimir PDF
            </Button>
          </div>
        </div>

        <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PATENT_REPORT_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedFields.has(field.key)}
                onChange={() => toggleField(field.key)}
              />
              {field.label}
            </label>
          ))}
        </div>

        <div className="print-area space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
              <p className="text-xs text-slate-500">Generado el {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-xs text-slate-400">Total: {records.length}</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {charts.map((chart) => (
              <PieChartCard key={chart.title} title={chart.title} data={chart.data} />
            ))}
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left uppercase text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-2 py-2">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    {columns.map((col) => {
                      const value = record[col.key];
                      const display =
                        col.key === "categoria"
                          ? formatPatentCategory(record.categoria)
                          : col.key === "createdAt" || col.key === "updatedAt"
                            ? formatDate(String(value))
                            : String(value || "-");
                      return (
                        <td key={col.key} className="px-2 py-2 text-slate-700">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length || 1} className="px-2 py-6 text-center text-slate-400">
                      No hay datos para el reporte.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------ Tests ------------------------------------
(function tests() {
  const kpis = computeKpis(SEED_PAPERS);
  console.assert(kpis.total === SEED_PAPERS.length, "Total debe coincidir con seed");
  console.assert(kpis.enProceso + kpis.finalizados === kpis.total, "Status total debe cuadrar");
  const ods = odsCounts(SEED_PAPERS);
  console.assert(Object.keys(ods).length > 0, "Debe contar ODS");
})();
