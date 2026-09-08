import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CheckCircle2, Crown, Flame, Search, Star, Trophy, Upload } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import ReservationsCalendar from "../common/ReservationsCalendar";
import TrlDashboard from "./trl/TrlDashboard";

type Metrics = {
  users: number;
  students: number;
  projects: number;
  pendingProjects: number;
  pendingReservations: number;
  tasks: number;
  submissions: number;
  studentsByCareer: { career: string; total: number }[];
  studentsByCampus: { campus: string; total: number }[];
  projectsByCampus: { campus: string; total: number }[];
  researchLineByCareer: { career: string; research_line: string; total: number }[];
  researchLineTotals: { research_line: string; total: number }[];
  odsByResearchLine: { research_line: string; ods: string; total: number }[];
  campusTaskStatus: { campus: string; total_active_tasks: number; completed_active_tasks: number }[];
};

type MetricsAll = {
  generatedAt?: string;
  summary: {
    users: number;
    admins: number;
    students: number;
    projects: number;
    projectsApproved: number;
    projectsPending: number;
    projectsRejected: number;
    members: number;
    tasks: number;
    taskSubmissions: number;
    phaseSubmissions: number;
    reservations: number;
    reservationsPending: number;
    applications: number;
  };
  studentsByCareer: { career: string; total: number }[];
  studentsByCampus: { campus: string; total: number }[];
  projectsByCampus: { campus: string; total: number }[];
  researchLineByCareer: { career: string; research_line: string; total: number }[];
  researchLineTotals: { research_line: string; total: number }[];
  odsByResearchLine: { research_line: string; ods: string; total: number }[];
  projectsByStatus: { status: string; total: number }[];
  tasksByScope: { scope: string; total: number }[];
  taskSubmissionsByStatus: { status: string; total: number }[];
  phaseSubmissionsByStatus: { status: string; total: number }[];
  reservationsByStatus: { status: string; total: number }[];
  applicationsByStatus: { status: string; total: number }[];
};

type Project = {
  id: string;
  title: string;
  description?: string;
  invite_code?: string;
  approval_status?: string;
  member_count?: number;
  score?: number;
};

type Reservation = {
  id: string;
  project_id: string;
  title: string;
  start_at: string;
  end_at: string;
  notes?: string;
  status: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  due_at?: string;
  scope: "global" | "project";
  category?: string | null;
  task_group?: string | null;
  icon_key?: string | null;
  points?: number;
  active?: boolean;
};

type ProjectTaskAssignment = Task & {
  assigned?: boolean | number;
  assignment_active?: boolean | number;
};

type Submission = {
  id: string;
  project_id: string;
  submitter_name?: string;
  submitter_email?: string;
  url?: string;
  comment?: string;
  status: string;
  feedback?: string;
  points?: number;
  created_at: string;
  project_title?: string;
};

type ProjectTaskReport = {
  id: string;
  title: string;
  description?: string;
  due_at?: string;
  scope?: "global" | "project";
  category?: string | null;
  task_group?: string | null;
  points?: number;
  active?: boolean | number;
  assignment_active?: boolean | number;
  submission_id?: string | null;
  submission_status?: string | null;
  submission_feedback?: string | null;
  submission_points?: number | null;
  submission_created_at?: string | null;
  submission_url?: string | null;
  submission_comment?: string | null;
  submission_submitter_name?: string | null;
  submission_submitter_email?: string | null;
};

const RESEARCH_LINE_LABELS: Record<string, string> = {
  "Cambio climatico": "Cambio climático",
  "Energias renovables": "Energías renovables",
  "Tecnologias para la educacion": "Tecnologías para la educación",
  "Emprendedurismo e innovacion": "Emprendedurismo e innovación",
  "Salud publica": "Salud pública",
  "Gestion y politicas publicas": "Gestión y políticas públicas",
};

function displayResearchLine(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin línea";
  return RESEARCH_LINE_LABELS[raw] || raw;
}

const CAREER_LABELS = [
  "Administración",
  "Administración y Finanzas",
  "Administración y Gestión del Talento Humano",
  "Administración y Gestión Pública",
  "Administración y Marketing",
  "Administración y Negocios Digitales",
  "Administración y Negocios Internacionales",
  "Arquitectura",
  "Arquitectura y Diseño de Interiores",
  "Ciencia de la Computación",
  "Ciencias de la Comunicación",
  "Contabilidad y Finanzas",
  "Derecho",
  "Economía",
  "Educación con especialidad en innovación y aprendizaje digital",
  "Enfermería",
  "Farmacia y Bioquímica",
  "Ingeniería Ambiental",
  "Ingeniería Civil",
  "Ingeniería de Minas",
  "Ingeniería de Sistemas e Informática",
  "Ingeniería Eléctrica",
  "Ingeniería Empresarial",
  "Ingeniería Industrial",
  "Ingeniería Mecánica",
  "Ingeniería Mecatrónica",
  "Medicina Humana",
  "Nutrición y Dietética",
  "Odontología",
  "Psicología",
  "Tecnología Médica - Especialidad en Terapia Física y Rehabilitación",
  "Tecnología Médica - Laboratorio Clínico y Anatomía Patológica",
  "Tecnología Médica - Radiología",
];

const CAREER_LABELS_BY_KEY = new Map(CAREER_LABELS.map((label) => [normalizeLabelKey(label), label]));

function repairMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    const bytes = Array.from(value, (char) => char.charCodeAt(0));
    if (bytes.some((code) => code > 255)) return value;
    return decodeURIComponent(bytes.map((code) => `%${code.toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return value;
  }
}

function normalizeLabelKey(value: string) {
  return repairMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function displayCareer(value?: string | null) {
  const raw = repairMojibake(String(value || "").trim());
  if (!raw) return "Sin carrera";
  return CAREER_LABELS_BY_KEY.get(normalizeLabelKey(raw)) || raw;
}

function buildCareerMetricItems(rows: { career?: string | null; total: number }[]) {
  const totals = new Map<string, number>();
  for (const row of rows || []) {
    if (!hasCareerValue(row.career)) continue;
    const label = displayCareer(row.career);
    totals.set(label, (totals.get(label) || 0) + Number(row.total || 0));
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

function buildOdsImpactItems(odsByResearchLine: { research_line: string; ods: string; total: number }[]) {
  const totals = new Map<string, number>();
  for (const row of odsByResearchLine || []) {
    const label = row.ods || "Sin ODS";
    totals.set(label, (totals.get(label) || 0) + Number(row.total || 0));
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || Number(a.label.replace(/\D/g, "")) - Number(b.label.replace(/\D/g, "")));
}

function hasCareerValue(value?: string | null) {
  const raw = String(value || "").trim();
  return Boolean(raw && raw.toLowerCase() !== "sin carrera");
}

type Member = {
  id: string;
  email: string;
  name?: string;
  career?: string;
  campus?: string;
  cycle?: string;
  role: string;
};

type UserRow = {
  id: string;
  email: string;
  name?: string;
  role: string;
  created_at?: string;
  project_count?: number;
};

type Notification = {
  id: string;
  project_id?: string;
  type: string;
  message: string;
  created_at: string;
  read_at?: string;
};

type Props = {
  auth: { userId?: string };
  onLogout: () => void;
};

const tabBase = "px-3 py-1 rounded-xl text-xs border transition";
const tabActive = "bg-white text-slate-900 shadow";
const tabIdle = "bg-white/10 text-white hover:bg-white/20";

const TASK_ICON_OPTIONS = [
  { key: "star", label: "Estrella", Icon: Star },
  { key: "flame", label: "Fuego", Icon: Flame },
  { key: "crown", label: "Corona", Icon: Crown },
  { key: "trophy", label: "Trofeo", Icon: Trophy },
  { key: "check", label: "Check", Icon: CheckCircle2 },
  { key: "upload", label: "Subida", Icon: Upload },
] as const;

const formatCampusLabel = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "Sin sede";
  const lowered = raw.toLowerCase();
  if (lowered === "sin sede") return "Sin sede";
  return lowered
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
};

const normalizeCampusKey = (value?: string | null) => {
  const raw = String(value || "").trim().toLowerCase();
  return raw || "sin sede";
};

const hasCampusValue = (value?: string | null) => {
  const raw = String(value || "").trim().toLowerCase();
  return Boolean(raw && raw !== "sin sede");
};

export default function AdminDashboard({ auth, onLogout }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [message, setMessage] = useState("");

  const projectOptions = useMemo(() => projects.map((p) => ({ id: p.id, label: `${p.title} (${p.invite_code || "N/A"})` })), [projects]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const campusTaskIndicators = useMemo(() => {
    if (!metrics) return [];
    return metrics.campusTaskStatus.map((row) => {
      const total = Number(row.total_active_tasks || 0);
      const completed = Number(row.completed_active_tasks || 0);
      const rate = total > 0 ? completed / total : 0;
      if (total === 0) {
        return { ...row, rate, label: "Sin tareas activas", color: "bg-slate-300" };
      }
      if (rate >= 0.8) {
        return { ...row, rate, label: "Alto avance", color: "bg-emerald-500" };
      }
      if (rate >= 0.5) {
        return { ...row, rate, label: "Avance medio", color: "bg-amber-400" };
      }
      return { ...row, rate, label: "Bajo avance", color: "bg-rose-500" };
    });
  }, [metrics]);

  async function downloadMetricsCsv() {
    const apiBase = window.__APP_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiBase}/admin/metrics.csv`);
    if (!res.ok) {
      setMessage("No se pudo descargar el CSV.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function downloadAllMetricsCsv() {
    const apiBase = window.__APP_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiBase}/admin/metrics-all.csv`);
    if (!res.ok) {
      setMessage("No se pudo descargar el CSV completo.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metrics-all-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function loadAll() {
    try {
      const [metricsData, pending, reservationsData, projectsData] = await Promise.all([
        apiGet("/admin/metrics"),
        apiGet("/admin/projects?status=pending"),
        apiGet("/admin/reservations?status=requested"),
        apiGet("/admin/projects"),
      ]);
      setMetrics(metricsData);
      setPendingProjects(pending);
      setReservations(reservationsData);
      setProjects(projectsData);
    } catch (err: any) {
      setMessage(err.message || "Error cargando panel admin");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMembers(projectId: string) {
    setSelectedProjectId(projectId);
    const rows = await apiGet(`/admin/projects/${projectId}/members`);
    setMembers(rows);
  }

  async function approveProject(projectId: string, approved: boolean) {
    await apiPost(`/admin/projects/${projectId}/decision`, { approved });
    await loadAll();
  }

  async function decideReservation(id: string, approved: boolean) {
    await apiPost(`/reservations/${id}/decision`, { approved, adminId: auth.userId || null });
    await loadAll();
  }

  async function renameProject(projectId: string, title: string) {
    await apiPatch(`/admin/projects/${projectId}`, { title });
    await loadAll();
  }

  async function deleteProject(projectId: string) {
    await apiDelete(`/admin/projects/${projectId}`);
    if (selectedProjectId === projectId) {
      setSelectedProjectId("");
      setMembers([]);
    }
    await loadAll();
  }

  async function addMember(projectId: string, email: string, name: string) {
    await apiPost(`/admin/projects/${projectId}/members`, { email, name, role: "member" });
    await loadMembers(projectId);
  }

  async function removeMember(projectId: string, userId: string) {
    await apiDelete(`/admin/projects/${projectId}/members/${userId}`);
    await loadMembers(projectId);
  }

  async function moveMember(projectId: string, userId: string, targetProjectId: string) {
    await apiPost(`/admin/projects/${projectId}/move-member`, { userId, targetProjectId });
    await loadMembers(projectId);
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Panel administrador" message={message} onLogout={onLogout} userId={auth.userId} />

            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Metric label="Estudiantes" value={metrics.students} />
                <Metric label="Proyectos" value={metrics.projects} />
                <Metric label="Pendientes" value={metrics.pendingProjects} />
                <Metric label="Reservas" value={metrics.pendingReservations} />
                <Metric label="Tareas" value={metrics.tasks} />
                <Metric label="Envíos" value={metrics.submissions} />
              </div>
            )}
            {metrics && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-2 rounded-xl border text-xs" onClick={downloadMetricsCsv}>
                    Descargar métricas (CSV)
                  </button>
                  <button className="px-3 py-2 rounded-xl border text-xs" onClick={downloadAllMetricsCsv}>
                    Descargar todas las métricas (CSV)
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-6">
              {metrics && (
                <Section title="Métricas por sede y carrera">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <MetricList
                      title="Estudiantes por carrera"
                      items={buildCareerMetricItems(metrics.studentsByCareer)}
                    />
                    <MetricList
                      title="Estudiantes por sede"
                      items={metrics.studentsByCampus.map((row) => ({
                        label: formatCampusLabel(row.campus),
                        value: row.total,
                      }))}
                    />
                    <MetricList
                      title="Proyectos por sede"
                      items={metrics.projectsByCampus.map((row) => ({
                        label: formatCampusLabel(row.campus),
                        value: row.total,
                      }))}
                    />
                    <div className="rounded-2xl border p-3 bg-white shadow-sm">
                      <div className="text-xs text-slate-500 mb-2">Semáforo de tareas activas</div>
                      <div className="space-y-1 text-xs">
                        {campusTaskIndicators.length === 0 && <div className="text-slate-400">Sin datos</div>}
                        {campusTaskIndicators.map((row) => {
                          const pct = row.total_active_tasks ? Math.round((row.rate || 0) * 100) : 0;
                          const width = pct ? `${Math.max(3, pct)}%` : "0%";
                          return (
                          <div key={`campus-task-${row.campus}`} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${row.color}`} />
                                <span className="text-slate-600">{formatCampusLabel(row.campus)}</span>
                              </div>
                              <span className="shrink-0 font-semibold text-slate-900">
                                {pct}% · {row.label}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width }} />
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <MetricList
                      title="Líneas de investigación"
                      items={(metrics.researchLineTotals || []).map((row) => ({
                        label: displayResearchLine(row.research_line),
                        value: row.total,
                      }))}
                    />
                    <OdsImpactChart items={buildOdsImpactItems(metrics.odsByResearchLine || [])} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Los proyectos se cuentan por cada sede presente entre sus estudiantes.
                  </div>
                </Section>
              )}
              <Section title="Calendario FabLab">
                <ReservationsCalendar mode="admin" userId={auth.userId} />
              </Section>
              <Section title="Solicitudes de aprobación">
                <div className="space-y-2">
                  {pendingProjects.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3 shadow-sm">
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.invite_code || "N/A"}</div>
                        <div className="text-[10px] text-slate-400">{p.id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs" onClick={() => approveProject(p.id, true)}>
                          Aprobar
                        </button>
                        <button className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs" onClick={() => approveProject(p.id, false)}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingProjects.length === 0 && <div className="text-sm text-slate-500">No hay solicitudes pendientes.</div>}
                </div>
              </Section>

              <Section title="Solicitudes de reserva FabLab">
                <div className="space-y-2">
                  {reservations.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3 shadow-sm">
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(r.start_at).toLocaleString()} - {new Date(r.end_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs" onClick={() => decideReservation(r.id, true)}>
                          Aprobar
                        </button>
                        <button className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs" onClick={() => decideReservation(r.id, false)}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                  {reservations.length === 0 && <div className="text-sm text-slate-500">No hay reservas pendientes.</div>}
                </div>
              </Section>

              <Section title="Gestión de grupos">
                <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm overflow-hidden">
                  {!selectedProjectId ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {projects.map((p, index) => {
                        const firstWord = (p.title || "Proyecto").trim().split(/\s+/)[0] || "Proyecto";
                        return (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            className="min-h-[150px] cursor-pointer rounded-2xl border border-violet-200 bg-violet-50/90 p-4 shadow-md shadow-violet-100 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                            onClick={() => loadMembers(p.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                loadMembers(p.id);
                              }
                            }}
                          >
                            <div className="flex h-full flex-col justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">Grupo {index + 1}</div>
                                <div className="mt-1 line-clamp-3 text-sm font-semibold text-slate-900">{p.title}</div>
                                <div className="mt-2 text-xs text-slate-600">{p.invite_code || "N/A"}</div>
                                <div className="mt-1 truncate text-[10px] text-slate-400">{p.id}</div>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-violet-700 shadow-sm">
                                  {p.member_count || 0} miembros
                                </div>
                                <div className="text-[11px] font-medium text-violet-700">{firstWord}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="rounded-xl border border-violet-200 bg-white/80 px-2 py-1 text-xs text-slate-700"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    renameProject(p.id, prompt("Nuevo título", p.title) || p.title);
                                  }}
                                >
                                  Renombrar
                                </button>
                                <button
                                  className="rounded-xl border border-rose-100 bg-white/80 px-2 py-1 text-xs text-rose-600"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteProject(p.id);
                                  }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {projects.length === 0 && <div className="text-sm text-slate-500">No hay proyectos registrados.</div>}
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3 lg:grid-cols-[9rem_minmax(0,1fr)]">
                      <div className="max-h-[640px] min-w-0 space-y-2 overflow-y-auto rounded-2xl border border-violet-100 bg-violet-50/70 p-2">
                        {projects.map((p, index) => {
                          const firstWord = (p.title || "Proyecto").trim().split(/\s+/)[0] || "Proyecto";
                          return (
                            <button
                              key={p.id}
                              className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs transition ${
                                selectedProjectId === p.id
                                  ? "border-violet-300 bg-white text-violet-800 shadow-sm"
                                  : "border-transparent bg-white/55 text-slate-600 hover:bg-white"
                              }`}
                              onClick={() => loadMembers(p.id)}
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
                                {index + 1}
                              </span>
                              <span className="min-w-0 truncate font-medium">{firstWord}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex min-w-0 items-start justify-between gap-3 border-b pb-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">Miembros del proyecto</div>
                            <div className="truncate text-xs text-slate-500">{selectedProject?.title || "Proyecto seleccionado"}</div>
                          </div>
                          <button
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => {
                              setSelectedProjectId("");
                              setMembers([]);
                            }}
                            aria-label="Cerrar miembros del proyecto"
                          >
                            ×
                          </button>
                        </div>

                        <div className="min-w-0 space-y-2">
                          {members.map((m) => (
                            <div key={m.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">{m.name || "Sin nombre"}</div>
                                <div className="break-all text-xs text-slate-500">{m.email}</div>
                              </div>
                              <div className="flex min-w-0 flex-col gap-2 sm:w-[220px] sm:flex-row sm:items-center sm:justify-end">
                                <button className="shrink-0 text-left text-xs text-rose-600 sm:text-center" onClick={() => removeMember(selectedProjectId, m.id)}>
                                  Quitar
                                </button>
                                <select
                                  className="h-8 w-full min-w-0 rounded-xl border bg-white px-2 text-xs sm:w-40"
                                  onChange={(e) => moveMember(selectedProjectId, m.id, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    Mover a...
                                  </option>
                                  {projectOptions
                                    .filter((p) => p.id !== selectedProjectId)
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.label}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          ))}
                          {members.length === 0 && <div className="text-xs text-slate-500">Sin miembros.</div>}
                          <div className="pt-2">
                            <AddMemberForm onAdd={(email, name) => addMember(selectedProjectId, email, name)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminTasksPage({ auth, onLogout }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvedProjects, setApprovedProjects] = useState<Project[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectTaskAssignment[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<Submission[]>([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [reviewScope, setReviewScope] = useState<"global" | "project">("global");
  const [taskStatusTab, setTaskStatusTab] = useState<"global" | "project">("global");
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState("");
  const [selectedReviewProjectId, setSelectedReviewProjectId] = useState("");
  const [reviewTasks, setReviewTasks] = useState<ProjectTaskReport[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskScope, setNewTaskScope] = useState<"global" | "project">("global");
  const [newTaskProjectIds, setNewTaskProjectIds] = useState<string[]>([]);
  const [newTaskActive, setNewTaskActive] = useState(false);
  const [newTaskIcon, setNewTaskIcon] = useState<string>("star");
  const [newTaskPoints, setNewTaskPoints] = useState<string>("");
  const [newTaskCategory, setNewTaskCategory] = useState<string>("");
  const [newTaskGroup, setNewTaskGroup] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { feedback: string }>>({});

  async function loadTasks() {
    try {
      const rows = await apiGet("/admin/tasks");
      setTasks(rows);
    } catch (err: any) {
      setMessage(err.message || "Error cargando tareas");
    }
  }

  async function loadApprovedProjects() {
    try {
      const rows = await apiGet("/admin/projects?status=approved");
      setApprovedProjects(rows);
    } catch (err: any) {
      setMessage(err.message || "Error cargando proyectos aprobados");
    }
  }

  async function loadProjectAssignments(projectId: string) {
    if (!projectId) {
      setProjectAssignments([]);
      return;
    }
    try {
      const rows = await apiGet(`/admin/projects/${projectId}/task-assignments`);
      setProjectAssignments(rows);
    } catch (err: any) {
      setMessage(err.message || "Error cargando tareas del proyecto");
    }
  }

  async function loadReviewProjectTasks(projectId: string) {
    if (!projectId) {
      setReviewTasks([]);
      return;
    }
    try {
      const rows = await apiGet(`/admin/projects/${projectId}/tasks?includeInactive=1`);
      setReviewTasks(rows);
    } catch (err: any) {
      setMessage(err.message || "Error cargando revisión del proyecto");
    }
  }

  async function toggleTaskActive(taskId: string, nextActive: boolean) {
    setBusy(true);
    setMessage("");
    try {
      await apiPatch(`/admin/tasks/${taskId}/active`, { active: nextActive });
      await loadTasks();
      if (selectedTaskProjectId) await loadProjectAssignments(selectedTaskProjectId);
      if (selectedReviewProjectId) await loadReviewProjectTasks(selectedReviewProjectId);
    } catch (err: any) {
      setMessage(err.message || "Error actualizando estado de tarea");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProjectTaskActive(taskId: string, nextActive: boolean) {
    if (!selectedTaskProjectId) return setMessage("Selecciona un proyecto.");
    setBusy(true);
    setMessage("");
    try {
      await apiPatch(`/admin/projects/${selectedTaskProjectId}/tasks/${taskId}/active`, { active: nextActive });
      await loadProjectAssignments(selectedTaskProjectId);
      if (selectedReviewProjectId === selectedTaskProjectId) await loadReviewProjectTasks(selectedReviewProjectId);
    } catch (err: any) {
      setMessage(err.message || "Error actualizando tarea del proyecto");
    } finally {
      setBusy(false);
    }
  }

  function toggleNewTaskProject(projectId: string) {
    setNewTaskProjectIds((prev) => (prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]));
  }

  async function deleteTask(taskId: string) {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiDelete(`/admin/tasks/${taskId}`);
      await loadTasks();
      if (selectedTaskProjectId) await loadProjectAssignments(selectedTaskProjectId);
      if (selectedReviewProjectId) await loadReviewProjectTasks(selectedReviewProjectId);
    } catch (err: any) {
      setMessage(err.message || "Error eliminando tarea");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadTasks();
    loadApprovedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTaskProjectId && approvedProjects.length > 0) {
      setSelectedTaskProjectId(approvedProjects[0].id);
    }
    if (!selectedReviewProjectId && approvedProjects.length > 0) {
      setSelectedReviewProjectId(approvedProjects[0].id);
    }
  }, [approvedProjects, selectedTaskProjectId, selectedReviewProjectId]);

  useEffect(() => {
    if (selectedTaskProjectId) {
      loadProjectAssignments(selectedTaskProjectId);
    } else {
      setProjectAssignments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskProjectId]);

  useEffect(() => {
    const next: Record<string, { feedback: string }> = {};
    for (const task of reviewTasks) {
      if (task.submission_id) {
        next[task.submission_id] = { feedback: task.submission_feedback || "" };
      }
    }
    setReviewDrafts(next);
  }, [reviewTasks]);

  useEffect(() => {
    if (selectedReviewProjectId) {
      loadReviewProjectTasks(selectedReviewProjectId);
    } else {
      setReviewTasks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReviewProjectId]);

  const filteredTasks = useMemo(() => tasks.filter((t) => t.scope === reviewScope), [tasks, reviewScope]);
  const activeTaskPoints = useMemo(() => tasks.find((t) => t.id === activeTaskId)?.points ?? 0, [tasks, activeTaskId]);
  const taskCategories = useMemo(() => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[], [tasks]);
  const taskGroups = useMemo(() => Array.from(new Set(tasks.map((t) => t.task_group).filter(Boolean))) as string[], [tasks]);
  const selectedTaskProject = useMemo(() => approvedProjects.find((p) => p.id === selectedTaskProjectId), [approvedProjects, selectedTaskProjectId]);
  const selectedReviewProject = useMemo(() => approvedProjects.find((p) => p.id === selectedReviewProjectId), [approvedProjects, selectedReviewProjectId]);
  const [openTaskCategories, setOpenTaskCategories] = useState<Record<string, boolean>>({});
  const tasksByReviewCategory = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const key = task.category || "Sin categoría";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [filteredTasks]);

  const allTasksByCategory = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.category || "Sin categoría";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [tasks]);

  const reviewTasksByCategory = useMemo(() => {
    const map = new Map<string, ProjectTaskReport[]>();
    for (const task of reviewTasks) {
      const key = task.category || "Sin categoría";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [reviewTasks]);

  const projectAssignmentsByCategory = useMemo(() => {
    const map = new Map<string, ProjectTaskAssignment[]>();
    for (const task of projectAssignments) {
      const key = task.category || "Sin categoría";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [projectAssignments]);

  useEffect(() => {
    const sections = [...allTasksByCategory, ...projectAssignmentsByCategory, ...reviewTasksByCategory];
    if (!sections.length) return;
    setOpenTaskCategories((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (next[section.category] === undefined) next[section.category] = true;
      }
      return next;
    });
  }, [allTasksByCategory, projectAssignmentsByCategory, reviewTasksByCategory]);

  const submissionsByProject = useMemo(() => {
    const map = new Map<string, { title: string; rows: Submission[] }>();
    for (const s of taskSubmissions) {
      const key = s.project_id || "N/A";
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(s);
      } else {
        map.set(key, { title: s.project_title || key, rows: [s] });
      }
    }
    return Array.from(map.entries());
  }, [taskSubmissions]);

  async function createTask() {
    if (!newTaskTitle) return setMessage("Completa el título de la tarea.");
    if (newTaskPoints === "" || !Number.isFinite(Number(newTaskPoints))) return setMessage("Ingresa el puntaje de la tarea.");
    if (newTaskScope === "project" && newTaskProjectIds.length === 0) return setMessage("Selecciona al menos un proyecto.");
    setBusy(true);
    setMessage("");
    try {
      await apiPost("/admin/tasks", {
        title: newTaskTitle,
        description: newTaskDescription,
        scope: newTaskScope,
        projectIds: newTaskScope === "project" ? newTaskProjectIds : [],
        adminId: auth.userId || null,
        iconKey: newTaskIcon,
        points: Number(newTaskPoints),
        category: newTaskCategory,
        taskGroup: newTaskGroup,
        active: newTaskActive,
      });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskProjectIds([]);
      setNewTaskActive(false);
      setNewTaskPoints("");
      setNewTaskCategory("");
      setNewTaskGroup("");
      await loadTasks();
      if (selectedTaskProjectId) await loadProjectAssignments(selectedTaskProjectId);
      if (selectedReviewProjectId) await loadReviewProjectTasks(selectedReviewProjectId);
    } catch (err: any) {
      setMessage(err.message || "Error creando tarea");
    } finally {
      setBusy(false);
    }
  }

  async function loadTaskSubmissions(taskId: string) {
    setActiveTaskId(taskId);
    const rows = await apiGet(`/admin/tasks/${taskId}/submissions`);
    setTaskSubmissions(rows);
  }

  async function sendFeedback(taskId: string, submissionId: string, feedback: string) {
    if (!selectedReviewProjectId) return setMessage("Selecciona un proyecto para revisar.");
    setBusy(true);
    setMessage("");
    try {
      await apiPost(`/admin/tasks/${taskId}/feedback`, { submissionId, feedback, projectId: selectedReviewProjectId });
      await loadReviewProjectTasks(selectedReviewProjectId);
      setMessage("Envío aceptado.");
    } catch (err: any) {
      setMessage(err.message || "Error revisando envío");
    } finally {
      setBusy(false);
    }
  }

  async function rejectSubmission(taskId: string, submissionId: string) {
    if (!selectedReviewProjectId) return setMessage("Selecciona un proyecto para revisar.");
    if (!confirm("¿Rechazar este envío? Se eliminará y el estudiante deberá reenviar.")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiPost(`/admin/tasks/${taskId}/submissions/${submissionId}/reject`, { projectId: selectedReviewProjectId });
      await loadReviewProjectTasks(selectedReviewProjectId);
      setMessage("Envío rechazado.");
    } catch (err: any) {
      setMessage(err.message || "Error rechazando envío");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Gestión de tareas" message={message} onLogout={onLogout} userId={auth.userId} />

            <div className="grid md:grid-cols-[1fr_1fr] gap-4">
              <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
                <div className="text-sm font-semibold">Crear tarea</div>
                <input className="border rounded-xl px-3 py-2 text-sm w-full" placeholder="Título" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
                <textarea
                  className="border rounded-xl px-3 py-2 text-sm w-full min-h-[100px]"
                  placeholder="Descripción"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                />
                <div className="text-xs text-slate-500">Icono</div>
                <div className="flex flex-wrap gap-2">
                  {TASK_ICON_OPTIONS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs border ${
                        newTaskIcon === key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
                      }`}
                      onClick={() => setNewTaskIcon(key)}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  className="border rounded-xl px-3 py-2 text-sm w-full"
                  placeholder="Puntaje de la tarea"
                  type="number"
                  min={0}
                  value={newTaskPoints}
                  onChange={(e) => setNewTaskPoints(e.target.value)}
                />
                <input
                  className="border rounded-xl px-3 py-2 text-sm w-full"
                  placeholder="Categoría (ej: Propiedad intelectual)"
                  list="task-categories"
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                />
                <datalist id="task-categories">
                  {taskCategories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <input
                  className="border rounded-xl px-3 py-2 text-sm w-full"
                  placeholder="Grupo (ej: Touchpoints)"
                  list="task-groups"
                  value={newTaskGroup}
                  onChange={(e) => setNewTaskGroup(e.target.value)}
                />
                <datalist id="task-groups">
                  {taskGroups.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={newTaskScope === "global"} onChange={() => setNewTaskScope("global")} />
                    Global
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={newTaskScope === "project"} onChange={() => setNewTaskScope("project")} />
                    Por proyecto
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newTaskActive} onChange={(e) => setNewTaskActive(e.target.checked)} />
                  {newTaskScope === "global" ? "Publicar como activa" : "Habilitar al crear para los proyectos seleccionados"}
                </label>
                {newTaskScope === "project" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Proyectos aprobados</span>
                      <span>{newTaskProjectIds.length} seleccionados</span>
                    </div>
                    <div className="max-h-44 overflow-auto rounded-xl border bg-white">
                      {approvedProjects.map((project) => (
                        <label key={project.id} className="flex items-start gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                          <input
                            className="mt-0.5"
                            type="checkbox"
                            checked={newTaskProjectIds.includes(project.id)}
                            onChange={() => toggleNewTaskProject(project.id)}
                          />
                          <span>
                            <span className="font-semibold text-slate-700">{project.title}</span>
                            <span className="block text-[10px] text-slate-500">{project.invite_code || project.id}</span>
                          </span>
                        </label>
                      ))}
                      {approvedProjects.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No hay proyectos aprobados.</div>}
                    </div>
                  </div>
                )}
                <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm" disabled={busy} onClick={createTask}>
                  Crear tarea
                </button>
              </div>

              <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
                <div className="text-sm font-semibold">Estado de tareas</div>
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1 rounded-xl text-xs border ${taskStatusTab === "global" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"}`}
                    onClick={() => setTaskStatusTab("global")}
                  >
                    Globales
                  </button>
                  <button
                    className={`px-3 py-1 rounded-xl text-xs border ${taskStatusTab === "project" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"}`}
                    onClick={() => setTaskStatusTab("project")}
                  >
                    Por proyecto
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {taskStatusTab === "global" &&
                    allTasksByCategory.map((section) => (
                      <div key={section.category} className="space-y-2">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs text-slate-700 bg-white"
                          onClick={() =>
                            setOpenTaskCategories((prev) => ({
                              ...prev,
                              [section.category]: !prev[section.category],
                            }))
                          }
                        >
                          <span className="font-semibold">{section.category}</span>
                          <span className="text-[10px] text-slate-500">{openTaskCategories[section.category] ? "Ocultar" : "Ver tareas"}</span>
                        </button>
                        {openTaskCategories[section.category] &&
                          section.items.map((t) => {
                            const isGlobal = t.scope === "global";
                            const isActive = Boolean(t.active);
                            return (
                              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b last:border-b-0 pb-2">
                                <div>
                                  <div className="font-semibold">{t.title}</div>
                                  <div className="text-slate-500">
                                    {(t.category || "Sin categoría") + (t.task_group ? ` · ${t.task_group}` : "")}
                                  </div>
                                  <div className="text-slate-500">{isGlobal ? "Global" : "Por proyecto"} · {t.points ?? 0} pts</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isGlobal ? (
                                    <>
                                      <span
                                        className={`rounded-full px-2 py-1 text-[10px] ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                                      >
                                        {isActive ? "Activa" : "Inactiva"}
                                      </span>
                                      <button className="px-2 py-1 border rounded-xl text-xs" disabled={busy} onClick={() => toggleTaskActive(t.id, !isActive)}>
                                        {isActive ? "Bloquear" : "Activar"}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="rounded-full px-2 py-1 text-[10px] bg-sky-100 text-sky-700">Gestión por proyecto</span>
                                  )}
                                  <button className="px-2 py-1 border rounded-xl text-xs text-rose-600" disabled={busy} onClick={() => deleteTask(t.id)}>
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  {taskStatusTab === "global" && allTasksByCategory.length === 0 && <div className="text-slate-500">Sin tareas.</div>}

                  {taskStatusTab === "project" && (
                    <div className="space-y-3">
                      <select
                        className="border rounded-xl px-3 py-2 text-sm w-full"
                        value={selectedTaskProjectId}
                        onChange={(e) => setSelectedTaskProjectId(e.target.value)}
                      >
                        <option value="">Selecciona un proyecto</option>
                        {approvedProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title} ({project.invite_code || "N/A"})
                          </option>
                        ))}
                      </select>
                      {selectedTaskProject && (
                        <div className="text-[11px] text-slate-500">
                          Proyecto seleccionado: {selectedTaskProject.title} · {selectedTaskProject.id}
                        </div>
                      )}
                      {projectAssignmentsByCategory.map((section) => (
                        <div key={section.category} className="space-y-2">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs text-slate-700 bg-white"
                            onClick={() =>
                              setOpenTaskCategories((prev) => ({
                                ...prev,
                                [section.category]: !prev[section.category],
                              }))
                            }
                          >
                            <span className="font-semibold">{section.category}</span>
                            <span className="text-[10px] text-slate-500">{openTaskCategories[section.category] ? "Ocultar" : "Ver tareas"}</span>
                          </button>
                          {openTaskCategories[section.category] &&
                            section.items.map((t) => {
                              const isActive = Boolean(t.assignment_active);
                              const scopeLabel = t.scope === "global" ? "Global" : "Por proyecto";
                              return (
                                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b last:border-b-0 pb-2">
                                  <div>
                                    <div className="font-semibold">{t.title}</div>
                                    <div className="text-slate-500">
                                      {(t.category || "Sin categoría") + (t.task_group ? ` · ${t.task_group}` : "")}
                                    </div>
                                    <div className="text-slate-500">{scopeLabel} · {t.points ?? 0} pts</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-1 text-[10px] ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                                    >
                                      {isActive ? "Activa" : "Inactiva"}
                                    </span>
                                    <button className="px-2 py-1 border rounded-xl text-xs" disabled={busy} onClick={() => toggleProjectTaskActive(t.id, !isActive)}>
                                      {isActive ? "Bloquear" : "Activar"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ))}
                      {selectedTaskProjectId && projectAssignmentsByCategory.length === 0 && <div className="text-slate-500">Sin tareas asignadas.</div>}
                      {!selectedTaskProjectId && <div className="text-slate-500">Selecciona un proyecto para ver sus tareas.</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
                <div className="text-sm font-semibold">Revisión por proyecto</div>
                <select className="border rounded-xl px-3 py-2 text-sm w-full" value={selectedReviewProjectId} onChange={(e) => setSelectedReviewProjectId(e.target.value)}>
                  <option value="">Selecciona un proyecto</option>
                  {approvedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title} ({project.invite_code || "N/A"})
                    </option>
                  ))}
                </select>
                {selectedReviewProject && (
                  <div className="text-[11px] text-slate-500">
                    Proyecto seleccionado: {selectedReviewProject.title} · {selectedReviewProject.id}
                  </div>
                )}
                {selectedReviewProjectId && <div className="text-xs text-slate-500">{reviewTasks.length} tareas asignadas al proyecto.</div>}
                {!selectedReviewProjectId && <div className="text-xs text-slate-500">Selecciona un proyecto para revisar sus tareas.</div>}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border p-4 bg-white shadow-sm space-y-3">
              <div>
                <div className="text-sm font-semibold">Tareas del proyecto seleccionado</div>
                <div className="text-xs text-slate-500">Revisa cada tarea habilitada del proyecto.</div>
              </div>
              {!selectedReviewProjectId && <div className="text-xs text-slate-500">Selecciona un proyecto para revisar.</div>}
              {selectedReviewProjectId &&
                reviewTasksByCategory.map((section) => (
                  <div key={section.category} className="space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs text-slate-700 bg-white"
                      onClick={() =>
                        setOpenTaskCategories((prev) => ({
                          ...prev,
                          [section.category]: !prev[section.category],
                        }))
                      }
                    >
                      <span className="font-semibold">{section.category}</span>
                      <span className="text-[10px] text-slate-500">{openTaskCategories[section.category] ? "Ocultar" : "Ver tareas"}</span>
                    </button>
                    {openTaskCategories[section.category] &&
                      section.items.map((task) => {
                        const submissionId = task.submission_id || "";
                        const isAssignmentActive = Boolean(task.assignment_active);
                        const isReviewed = task.submission_status === "reviewed";
                        const isSubmitted = task.submission_status === "submitted";
                        const statusLabel = !isAssignmentActive ? "Inactiva" : isReviewed ? "Revisada" : isSubmitted ? "Enviada" : "Pendiente";
                        return (
                          <div key={task.id} className="rounded-xl border p-3 text-xs space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold">{task.title}</div>
                                <div className="text-slate-500">
                                  {(task.scope === "global" ? "Global" : "Por proyecto") + " · " + (task.points ?? 0) + " pts"}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] ${
                                  !isAssignmentActive
                                    ? "bg-slate-100 text-slate-600"
                                    : task.submission_status === "reviewed"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : task.submission_status === "submitted"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            {submissionId ? (
                              <>
                                <div className="font-medium">{task.submission_submitter_name || task.submission_submitter_email || "Sin nombre"}</div>
                                {task.submission_url && (
                                  <a className="text-indigo-600 underline break-all" href={task.submission_url} target="_blank" rel="noreferrer">
                                    {task.submission_url}
                                  </a>
                                )}
                                {task.submission_comment && <div>{task.submission_comment}</div>}
                                {task.submission_created_at && <div className="text-slate-500">{new Date(task.submission_created_at).toLocaleString()}</div>}
                                {isReviewed ? (
                                  <>
                                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                                      Tarea aceptada{typeof task.submission_points === "number" ? ` · ${task.submission_points} pts` : ""}.
                                      {task.submission_feedback ? <div className="mt-1 text-emerald-800">Observaciones: {task.submission_feedback}</div> : null}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs"
                                        disabled={busy}
                                        onClick={() => rejectSubmission(task.id, submissionId)}
                                      >
                                        Rechazar
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <textarea
                                      className="border rounded-xl px-3 py-2 text-xs w-full"
                                      placeholder="Observaciones del admin"
                                      value={reviewDrafts[submissionId]?.feedback || ""}
                                      onChange={(e) =>
                                        setReviewDrafts((prev) => ({
                                          ...prev,
                                          [submissionId]: { feedback: e.target.value },
                                        }))
                                      }
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs"
                                        disabled={busy}
                                        onClick={() => sendFeedback(task.id, submissionId, reviewDrafts[submissionId]?.feedback || "")}
                                      >
                                        Aceptar
                                      </button>
                                      <button
                                        type="button"
                                        className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs"
                                        disabled={busy}
                                        onClick={() => rejectSubmission(task.id, submissionId)}
                                      >
                                        Rechazar
                                      </button>
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              <div className="text-slate-500">Pendiente de envío.</div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              {selectedReviewProjectId && reviewTasks.length === 0 && <div className="text-xs text-slate-500">Sin tareas asignadas para este proyecto.</div>}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminMetricsPage({ auth, onLogout }: Props) {
  const [metrics, setMetrics] = useState<MetricsAll | null>(null);
  const [message, setMessage] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [didInitSelection, setDidInitSelection] = useState(false);
  const [selectedCareers, setSelectedCareers] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({});
  const [didInitFilters, setDidInitFilters] = useState(false);

  async function loadMetrics() {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiGet("/admin/metrics-all");
      setMetrics(data);
    } catch (err: any) {
      setMessage(err.message || "Error cargando métricas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const careerOptions = useMemo(() => {
    if (!metrics) return [];
    return buildCareerMetricItems(metrics.studentsByCareer).map((item) => item.label);
  }, [metrics]);

  const summaryItems = useMemo(() => {
    if (!metrics) return [];
    return [
      { key: "users", label: "Usuarios", value: metrics.summary.users },
      { key: "admins", label: "Admins", value: metrics.summary.admins },
      { key: "students", label: "Estudiantes", value: metrics.summary.students },
      { key: "projects", label: "Proyectos", value: metrics.summary.projects },
      { key: "projectsApproved", label: "Proyectos aprobados", value: metrics.summary.projectsApproved },
      { key: "projectsPending", label: "Proyectos pendientes", value: metrics.summary.projectsPending },
      { key: "projectsRejected", label: "Proyectos rechazados", value: metrics.summary.projectsRejected },
      { key: "members", label: "Miembros en proyectos", value: metrics.summary.members },
      { key: "tasks", label: "Tareas", value: metrics.summary.tasks },
      { key: "taskSubmissions", label: "Envíos de tareas", value: metrics.summary.taskSubmissions },
      { key: "phaseSubmissions", label: "Envíos por fases", value: metrics.summary.phaseSubmissions },
      { key: "reservations", label: "Reservas", value: metrics.summary.reservations },
      { key: "reservationsPending", label: "Reservas pendientes", value: metrics.summary.reservationsPending },
      { key: "applications", label: "Postulaciones", value: metrics.summary.applications },
    ];
  }, [metrics]);

  const sections = useMemo(() => {
    if (!metrics) return [];
    const careerSet = new Set(selectedCareers);
    return [
      {
        key: "studentsByCareer",
        title: "Estudiantes por carrera",
        items: buildCareerMetricItems(metrics.studentsByCareer).filter((item) => (selectedCareers.length ? careerSet.has(item.label) : false)),
      },
      {
        key: "studentsByCampus",
        title: "Estudiantes por sede",
        items: metrics.studentsByCampus.map((row) => ({ label: formatCampusLabel(row.campus), value: row.total })),
      },
      {
        key: "projectsByCampus",
        title: "Proyectos por sede",
        items: metrics.projectsByCampus.map((row) => ({ label: formatCampusLabel(row.campus), value: row.total })),
      },
      {
        key: "researchLineTotals",
        title: "Líneas de investigación",
        items: (metrics.researchLineTotals || []).map((row) => ({
          label: displayResearchLine(row.research_line),
          value: row.total,
        })),
      },
      {
        key: "odsImpact",
        title: "Proyectos por ODS impactado",
        items: buildOdsImpactItems(metrics.odsByResearchLine || []),
      },
      {
        key: "projectsByStatus",
        title: "Proyectos por estado",
        items: metrics.projectsByStatus.map((row) => ({ label: row.status || "Sin estado", value: row.total })),
      },
      {
        key: "tasksByScope",
        title: "Tareas por alcance",
        items: metrics.tasksByScope.map((row) => ({ label: row.scope || "Sin alcance", value: row.total })),
      },
      {
        key: "taskSubmissionsByStatus",
        title: "Envíos de tareas por estado",
        items: metrics.taskSubmissionsByStatus.map((row) => ({ label: row.status || "Sin estado", value: row.total })),
      },
      {
        key: "phaseSubmissionsByStatus",
        title: "Envíos de fases por estado",
        items: metrics.phaseSubmissionsByStatus.map((row) => ({ label: row.status || "Sin estado", value: row.total })),
      },
      {
        key: "reservationsByStatus",
        title: "Reservas por estado",
        items: metrics.reservationsByStatus.map((row) => ({ label: row.status || "Sin estado", value: row.total })),
      },
      {
        key: "applicationsByStatus",
        title: "Postulaciones por estado",
        items: metrics.applicationsByStatus.map((row) => ({ label: row.status || "Sin estado", value: row.total })),
      },
    ];
  }, [metrics, selectedCareers]);

  const allKeys = useMemo(() => {
    return [
      ...summaryItems.map((item) => `summary:${item.key}`),
      ...sections.map((section) => `section:${section.key}`),
    ];
  }, [summaryItems, sections]);

  useEffect(() => {
    if (!didInitSelection && allKeys.length) {
      setSelectedKeys(allKeys);
      setDidInitSelection(true);
    }
  }, [allKeys, didInitSelection]);

  useEffect(() => {
    if (!metrics || didInitFilters) return;
    if (careerOptions.length) setSelectedCareers(careerOptions);
    if (careerOptions.length) setDidInitFilters(true);
  }, [metrics, careerOptions, didInitFilters]);

  function toggleKey(key: string) {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  function selectAll() {
    setSelectedKeys(allKeys);
  }

  function clearAll() {
    setSelectedKeys([]);
  }

  function getSelections(keys: string[]) {
    return {
      summary: summaryItems.filter((item) => keys.includes(`summary:${item.key}`)),
      sections: sections.filter((section) => keys.includes(`section:${section.key}`)),
    };
  }

  const selectedSummary = getSelections(selectedKeys).summary;
  const selectedSections = getSelections(selectedKeys).sections;

  async function downloadAllMetricsCsv() {
    const apiBase = window.__APP_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiBase}/admin/metrics-all.csv`);
    if (!res.ok) {
      setMessage("No se pudo descargar el CSV completo.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metrics-all-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildBarChart(items: { label: string; value: number }[]) {
    if (!items.length) return "";
    const max = Math.max(...items.map((item) => item.value), 1);
    return `
      <div class="chart">
        ${items
          .map((item) => {
            const pct = Math.round((item.value / max) * 100);
            return `
              <div class="bar-row">
                <div class="bar-label">${escapeHtml(item.label)}</div>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="bar-value">${item.value}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function generatePdfReport(keys = selectedKeys) {
    if (!metrics) return;
    const { summary, sections: selected } = getSelections(keys);
    const reportTitle = "Informe de métricas";
    const summaryRows = summary
      .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value}</td></tr>`)
      .join("");
    const sectionsHtml = selected
      .map((section) => {
        const rows = section.items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value}</td></tr>`).join("");
        const chart = buildBarChart(section.items);
        return `
          <section>
            <h2>${escapeHtml(section.title)}</h2>
            ${chart}
            <table>
              <thead><tr><th>Detalle</th><th>Valor</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="2">Sin datos</td></tr>`}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=960,height=700");
    if (!win) {
      setMessage("Permite las ventanas emergentes para generar el PDF.");
      return;
    }
    const generated = metrics.generatedAt ? new Date(metrics.generatedAt).toLocaleString() : new Date().toLocaleString();
    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(reportTitle)}</title>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; margin: 32px; }
            header { margin-bottom: 24px; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            h2 { font-size: 16px; margin: 20px 0 8px; }
            .meta { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; text-align: left; }
            th { background: #f8fafc; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 16px; }
            .summary-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
            .summary-card .label { font-size: 11px; color: #64748b; }
            .summary-card .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
            .chart { margin: 10px 0 12px; }
            .bar-row { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; align-items: center; font-size: 11px; margin-bottom: 6px; }
            .bar-label { color: #475569; }
            .bar-track { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
            .bar-fill { height: 100%; background: #6366f1; border-radius: 999px; }
            .bar-value { color: #0f172a; min-width: 28px; text-align: right; }
            section { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <header>
            <h1>${escapeHtml(reportTitle)}</h1>
            <div class="meta">Generado: ${escapeHtml(generated)}</div>
          </header>
          ${summary.length ? `
            <div class="summary">
              ${summary
                .map(
                  (item) => `
                    <div class="summary-card">
                      <div class="label">${escapeHtml(item.label)}</div>
                      <div class="value">${item.value}</div>
                    </div>
                  `
                )
                .join("")}
            </div>
          ` : ""}
          ${summaryRows ? `<table><thead><tr><th>Resumen</th><th>Valor</th></tr></thead><tbody>${summaryRows}</tbody></table>` : ""}
          ${sectionsHtml || "<p>Sin métricas seleccionadas.</p>"}
          <script>
            window.onload = () => setTimeout(() => window.print(), 300);
          </script>
        </body>
      </html>`);
    win.document.close();
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Métricas completas" message={message} onLogout={onLogout} userId={auth.userId} />

            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Selecciona las métricas</div>
                  <div className="text-xs text-slate-500">
                    Elige qué datos ver y exportar. Última actualización: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1 rounded-xl border text-xs" onClick={selectAll}>
                    Seleccionar todo
                  </button>
                  <button className="px-3 py-1 rounded-xl border text-xs" onClick={clearAll}>
                    Limpiar
                  </button>
                  <button className="px-3 py-1 rounded-xl border text-xs" onClick={downloadAllMetricsCsv}>
                    Descargar CSV
                  </button>
                  <button className="px-3 py-1 rounded-xl border text-xs" onClick={() => generatePdfReport(allKeys)}>
                    Reporte general (PDF)
                  </button>
                  <button className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs" onClick={() => generatePdfReport()}>
                    Generar informe PDF
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_1fr] gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Resumen</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summaryItems.map((item) => {
                      const key = `summary:${item.key}`;
                      return (
                        <label key={key} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
                          <input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggleKey(key)} />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Desgloses</div>
                  <div className="grid grid-cols-1 gap-2">
                    {sections.map((section) => {
                      const key = `section:${section.key}`;
                      return (
                        <div key={key} className="rounded-xl border px-3 py-2 text-xs space-y-2">
                          <label className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggleKey(key)} />
                              <span>{section.title}</span>
                            </span>
                          {section.key === "studentsByCareer" && (
                            <button
                              type="button"
                              className="text-[11px] text-slate-500 hover:text-slate-700"
                              onClick={() =>
                                setOpenFilters((prev) => ({
                                  ...prev,
                                  [section.key]: !prev[section.key],
                                }))
                              }
                            >
                              {openFilters[section.key] ? "Ocultar opciones" : "Seleccionar"}
                            </button>
                          )}
                        </label>
                          {section.key === "studentsByCareer" && openFilters.studentsByCareer && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {careerOptions.map((career) => (
                                <label key={career} className="flex items-center gap-2 text-[11px] text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={selectedCareers.includes(career)}
                                    onChange={() =>
                                      setSelectedCareers((prev) =>
                                        prev.includes(career) ? prev.filter((item) => item !== career) : [...prev, career]
                                      )
                                    }
                                  />
                                  <span>{career}</span>
                                </label>
                              ))}
                              {careerOptions.length === 0 && <div className="text-[11px] text-slate-400">No hay carreras</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {loading && <div className="text-sm text-slate-500">Cargando métricas...</div>}
              {!loading && selectedSummary.length > 0 && (
                <Section title="Resumen seleccionado">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selectedSummary.map((item) => (
                      <Metric key={item.key} label={item.label} value={item.value} />
                    ))}
                  </div>
                </Section>
              )}
              {!loading && selectedSections.length > 0 && (
                <Section title="Desgloses seleccionados">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedSections.map((section) =>
                      section.key === "odsImpact" ? (
                        <div key={section.key} className="md:col-span-3">
                          <OdsImpactChart items={section.items} />
                        </div>
                      ) : (
                        <MetricList key={section.key} title={section.title} items={section.items} />
                      )
                    )}
                  </div>
                </Section>
              )}
              {!loading && selectedSummary.length === 0 && selectedSections.length === 0 && (
                <div className="text-sm text-slate-500">Selecciona al menos una métrica para visualizar.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCampusStatusPage({ auth, onLogout }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await apiGet("/admin/metrics");
        setMetrics(data);
      } catch (err: any) {
        setMessage(err.message || "Error cargando status por sede");
      }
    }
    loadMetrics();
  }, []);

  const campusTaskIndicators = useMemo(() => {
    if (!metrics) return [];
    return metrics.campusTaskStatus.map((row) => {
      const total = Number(row.total_active_tasks || 0);
      const completed = Number(row.completed_active_tasks || 0);
      const rate = total > 0 ? completed / total : 0;
      if (total === 0) {
        return { ...row, rate, label: "Sin tareas activas", color: "bg-slate-300" };
      }
      if (rate >= 0.8) {
        return { ...row, rate, label: "Alto avance", color: "bg-emerald-500" };
      }
      if (rate >= 0.5) {
        return { ...row, rate, label: "Avance medio", color: "bg-amber-400" };
      }
      return { ...row, rate, label: "Bajo avance", color: "bg-rose-500" };
    });
  }, [metrics]);

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Status por sede" message={message} onLogout={onLogout} userId={auth.userId} />

            <Section title="Cumplimiento de tareas activas">
              <div className="rounded-2xl border p-4 bg-white shadow-sm">
                <div className="text-xs text-slate-500 mb-3">Semaforo por sede (tareas activas)</div>
                <div className="space-y-2 text-sm">
                  {campusTaskIndicators.length === 0 && <div className="text-slate-400">Sin datos</div>}
                  {campusTaskIndicators.map((row) => (
                    <div key={`campus-status-${row.campus}`} className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${row.color}`} />
                        <div className="text-slate-700">{formatCampusLabel(row.campus)}</div>
                      </div>
                      <div className="text-slate-600 text-xs">
                        {row.total_active_tasks ? Math.round((row.rate || 0) * 100) : 0}% · {row.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProjectReportsPage({ auth, onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<ProjectTaskReport[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const rows = await apiGet("/admin/projects?reportable=1");
        setProjects(rows);
      } catch (err: any) {
        setMessage(err.message || "Error cargando proyectos");
      }
    }
    loadProjects();
  }, []);

  function getProjectOptionLabel(project: Project) {
    return `${project.title}${project.invite_code ? ` (${project.invite_code})` : ""}`;
  }

  const normalizedProjectSearch = projectSearchTerm.trim().toLowerCase();
  const projectSearchResults = useMemo(() => {
    if (!normalizedProjectSearch) return [];
    return projects
      .filter((project) =>
        [project.title, project.invite_code, project.id].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedProjectSearch)
        )
      )
      .slice(0, 8);
  }, [projects, normalizedProjectSearch]);

  async function loadProjectData(projectId: string) {
    setSelectedProjectId(projectId);
    if (!projectId) {
      setMembers([]);
      setTasks([]);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const [membersData, tasksData] = await Promise.all([
        apiGet(`/admin/projects/${projectId}/members`),
        apiGet(`/admin/projects/${projectId}/tasks`),
      ]);
      setMembers(membersData);
      setTasks(tasksData);
    } catch (err: any) {
      setMessage(err.message || "Error cargando reporte");
    } finally {
      setLoading(false);
    }
  }

  function selectProject(project: Project) {
    setProjectSearchTerm(getProjectOptionLabel(project));
    loadProjectData(project.id);
  }

  function handleProjectSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedProjectSearch) {
      setMessage("Ingresa el nombre, código o ID del proyecto.");
      return;
    }
    const firstResult = projectSearchResults[0];
    if (!firstResult) {
      setMessage("No se encontró un proyecto con ese texto.");
      return;
    }
    selectProject(firstResult);
  }

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.submission_status === "submitted" || t.submission_status === "reviewed").length;
  const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const reportableMembers = useMemo(() => members.filter((m) => hasCareerValue(m.career)), [members]);

  const membersByCareer = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of reportableMembers) {
      const key = displayCareer(m.career);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [reportableMembers]);

  const membersByCampus = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of reportableMembers) {
      if (!hasCampusValue(m.campus)) continue;
      const key = normalizeCampusKey(m.campus);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label: formatCampusLabel(label), value }));
  }, [reportableMembers]);

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateProjectReport() {
    if (!selectedProject) {
      setMessage("Selecciona un proyecto para generar el reporte.");
      return;
    }
    const win = window.open("", "_blank", "width=980,height=720");
    if (!win) {
      setMessage("Permite las ventanas emergentes para generar el PDF.");
      return;
    }
    const generated = new Date().toLocaleString();
    const membersRows = reportableMembers
      .map(
        (m) =>
          `<tr><td>${escapeHtml(m.name || "Sin nombre")}</td><td>${escapeHtml(m.email)}</td><td>${escapeHtml(displayCareer(m.career))}</td><td>${escapeHtml(
            formatCampusLabel(m.campus)
          )}</td></tr>`
      )
      .join("");
    const tasksRows = tasks
      .map((t) => {
        const status =
          t.submission_status === "reviewed" ? "Revisada" : t.submission_status === "submitted" ? "Enviada" : "Pendiente";
        const link = t.submission_url
          ? `<a href="${escapeHtml(t.submission_url)}" target="_blank" rel="noreferrer">${escapeHtml(t.submission_url)}</a>`
          : "Sin envío";
        return `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(status)}</td><td>${t.submission_points ?? ""}</td><td>${link}</td></tr>`;
      })
      .join("");
    const careerRows = membersByCareer.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value}</td></tr>`).join("");
    const campusRows = membersByCampus.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value}</td></tr>`).join("");

    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Reporte de proyecto</title>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; margin: 32px; }
            header { margin-bottom: 18px; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            h2 { font-size: 16px; margin: 18px 0 6px; }
            .meta { font-size: 12px; color: #64748b; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
            .card .label { font-size: 11px; color: #64748b; }
            .card .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; text-align: left; }
            th { background: #f8fafc; }
            .progress { margin-top: 10px; }
            .track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
            .fill { height: 100%; background: #4f46e5; width: ${completionPct}%; }
            .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          </style>
        </head>
        <body>
          <header>
            <h1>Reporte de proyecto</h1>
            <div class="meta">Proyecto: ${escapeHtml(selectedProject.title)} ${selectedProject.invite_code ? `(${escapeHtml(selectedProject.invite_code)})` : ""}</div>
            <div class="meta">Generado: ${escapeHtml(generated)}</div>
          </header>

          <div class="summary">
            <div class="card">
              <div class="label">Tareas completadas</div>
              <div class="value">${completedTasks} / ${totalTasks}</div>
              <div class="progress">
                <div class="track"><div class="fill"></div></div>
                <div class="meta">${completionPct}% de tareas habilitadas</div>
              </div>
            </div>
            <div class="card">
              <div class="label">Participantes</div>
              <div class="value">${members.length}</div>
              <div class="meta">Miembros activos del proyecto</div>
            </div>
            <div class="card">
              <div class="label">Estado</div>
              <div class="value">${escapeHtml(selectedProject.approval_status || "Sin estado")}</div>
              <div class="meta">Aprobación del proyecto</div>
            </div>
          </div>

          <h2>Distribución por carrera y sede</h2>
          <div class="split">
            <table>
              <thead><tr><th>Carrera</th><th>Estudiantes</th></tr></thead>
              <tbody>${careerRows || `<tr><td colspan="2">Sin datos</td></tr>`}</tbody>
            </table>
            <table>
              <thead><tr><th>Sede</th><th>Estudiantes</th></tr></thead>
              <tbody>${campusRows || `<tr><td colspan="2">Sin datos</td></tr>`}</tbody>
            </table>
          </div>

          <h2>Participantes</h2>
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Carrera</th><th>Sede</th></tr></thead>
            <tbody>${membersRows || `<tr><td colspan="4">Sin miembros</td></tr>`}</tbody>
          </table>

          <h2>Tareas habilitadas del proyecto</h2>
          <table>
            <thead><tr><th>Tarea</th><th>Estado</th><th>Puntos</th><th>Link</th></tr></thead>
            <tbody>${tasksRows || `<tr><td colspan="4">Sin tareas habilitadas</td></tr>`}</tbody>
          </table>

          <script>
            window.onload = () => setTimeout(() => window.print(), 300);
          </script>
        </body>
      </html>`);
    win.document.close();
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Reporte por proyecto" message={message} onLogout={onLogout} userId={auth.userId} />

            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)_auto] lg:items-start">
                <div className="space-y-2">
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleProjectSearchSubmit}>
                    <label className="relative block flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className="h-10 w-full rounded-xl border px-9 text-sm"
                        placeholder="Buscar proyecto por nombre, código o ID"
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                      />
                    </label>
                    <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" type="submit" disabled={loading}>
                      Buscar
                    </button>
                  </form>
                  {normalizedProjectSearch && (
                    <div className="overflow-hidden rounded-xl border bg-white">
                      {projectSearchResults.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 ${
                            selectedProjectId === project.id ? "bg-indigo-50 text-indigo-700" : "text-slate-700"
                          }`}
                          onClick={() => selectProject(project)}
                        >
                          <span className="font-semibold">{project.title}</span>
                          <span className="ml-2 text-slate-500">{project.invite_code ? `(${project.invite_code})` : project.id}</span>
                        </button>
                      ))}
                      {projectSearchResults.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Sin resultados.</div>}
                    </div>
                  )}
                </div>
                <select
                  className="h-10 rounded-xl border px-3 py-2 text-sm"
                  value={selectedProjectId}
                  onChange={(e) => {
                    const project = projects.find((p) => p.id === e.target.value);
                    if (project) {
                      selectProject(project);
                    } else {
                      setProjectSearchTerm("");
                      loadProjectData("");
                    }
                  }}
                >
                  <option value="">Selecciona un proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.invite_code ? `(${p.invite_code})` : ""}
                    </option>
                  ))}
                </select>
                <button className="h-10 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white" onClick={generateProjectReport} disabled={!selectedProjectId || loading}>
                  Generar reporte PDF
                </button>
              </div>
              {loading && <div className="text-xs text-slate-500">Cargando datos del proyecto...</div>}
            </div>

            {selectedProject && (
              <div className="mt-6 space-y-6">
                <Section title="Resumen del proyecto">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Metric label="Tareas completadas" value={completedTasks} />
                    <Metric label="Tareas habilitadas" value={totalTasks} />
                    <Metric label="Participantes" value={reportableMembers.length} />
                    <Metric label="Avance (%)" value={completionPct} />
                  </div>
                </Section>

                <Section title="Participantes">
                  <div className="rounded-2xl border p-3 bg-white shadow-sm space-y-2 text-xs">
                    {reportableMembers.map((m) => (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b last:border-b-0 pb-2">
                        <div>
                          <div className="font-semibold">{m.name || "Sin nombre"}</div>
                          <div className="text-slate-500">{m.email}</div>
                        </div>
                        <div className="text-slate-600">
                          {displayCareer(m.career)} · {formatCampusLabel(m.campus)}
                        </div>
                      </div>
                    ))}
                    {reportableMembers.length === 0 && <div className="text-xs text-slate-500">Sin miembros.</div>}
                  </div>
                </Section>

                <Section title="Tareas habilitadas del proyecto">
                  <div className="rounded-2xl border p-3 bg-white shadow-sm space-y-2 text-xs">
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 pb-2">
                        <div>
                          <div className="font-semibold">{t.title}</div>
                          {t.description && <div className="text-slate-500">{t.description}</div>}
                          {t.submission_url && (
                            <a className="text-indigo-600 underline break-all" href={t.submission_url} target="_blank" rel="noreferrer">
                              {t.submission_url}
                            </a>
                          )}
                        </div>
                        <div className="text-slate-600">
                          {t.submission_status === "reviewed" ? "Revisada" : t.submission_status === "submitted" ? "Enviada" : "Pendiente"}
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && <div className="text-xs text-slate-500">Sin tareas habilitadas.</div>}
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCertificatesPage({ auth, onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const rows = await apiGet("/admin/projects");
        setProjects(rows);
      } catch (err: any) {
        setMessage(err.message || "Error cargando proyectos");
      }
    }
    loadProjects();
  }, []);

  async function loadMembers(projectId: string) {
    setSelectedProjectId(projectId);
    setLoading(true);
    setMessage("");
    try {
      const rows = await apiGet(`/admin/projects/${projectId}/members`);
      setMembers(rows);
    } catch (err: any) {
      setMessage(err.message || "Error cargando miembros");
    } finally {
      setLoading(false);
    }
  }

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) || null, [projects, selectedProjectId]);

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateCertificate() {
    if (!selectedProject) {
      setMessage("Selecciona un proyecto para generar el certificado.");
      return;
    }
    const win = window.open("", "_blank", "width=1024,height=768");
    if (!win) {
      setMessage("Permite las ventanas emergentes para generar el PDF.");
      return;
    }
    const generated = new Date().toLocaleDateString();
    const memberNames = members.map((m) => escapeHtml(m.name || m.email)).join(" · ");
    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Certificado de proyecto</title>
          <style>
            body { margin: 0; font-family: "Georgia", "Times New Roman", serif; color: #1f2937; }
            .page { width: 100%; min-height: 100vh; background: linear-gradient(135deg, #f8fafc, #eef2ff); padding: 40px; box-sizing: border-box; }
            .certificate { border: 6px double #4f46e5; padding: 40px; background: #fff; position: relative; min-height: 80vh; }
            .badge { position: absolute; top: 30px; right: 30px; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, #4f46e5, #312e81); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
            .watermark { position: absolute; bottom: 20px; right: 30px; font-size: 72px; color: rgba(79, 70, 229, 0.08); font-weight: 700; transform: rotate(-10deg); }
            h1 { font-size: 42px; margin: 0 0 12px; letter-spacing: 2px; }
            h2 { font-size: 22px; margin: 0 0 18px; color: #4f46e5; }
            .line { height: 2px; background: #e2e8f0; margin: 16px 0; }
            .label { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }
            .project { font-size: 28px; font-weight: 700; margin: 10px 0 6px; }
            .members { font-size: 14px; color: #475569; margin-top: 8px; }
            .meta { margin-top: 30px; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; }
            .signature { margin-top: 36px; display: flex; justify-content: space-between; gap: 20px; }
            .sig { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 12px; text-align: center; color: #475569; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="certificate">
              <div class="badge">Fab Lab</div>
              <div class="label">Certificado de participacion</div>
              <h1>Proyecto Fellowship</h1>
              <h2>${escapeHtml(selectedProject.title)}</h2>
              <div class="line"></div>
              <div class="label">Otorgado al equipo</div>
              <div class="project">${escapeHtml(selectedProject.title)}</div>
              <div class="members">${memberNames || "Equipo del proyecto"}</div>
              <div class="meta">
                <div>Código: ${escapeHtml(selectedProject.invite_code || "N/A")}</div>
                <div>Fecha: ${escapeHtml(generated)}</div>
              </div>
              <div class="signature">
                <div class="sig">Coordinación Fab Lab</div>
                <div class="sig">Direccion Academica</div>
              </div>
              <div class="watermark">FELLOW</div>
            </div>
          </div>
          <script>
            window.onload = () => setTimeout(() => window.print(), 300);
          </script>
        </body>
      </html>`);
    win.document.close();
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Certificados por proyecto" message={message} onLogout={onLogout} userId={auth.userId} />

            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="border rounded-xl px-3 py-2 text-sm"
                  value={selectedProjectId}
                  onChange={(e) => loadMembers(e.target.value)}
                >
                  <option value="">Selecciona un proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.invite_code ? `(${p.invite_code})` : ""}
                    </option>
                  ))}
                </select>
                <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm" onClick={generateCertificate} disabled={!selectedProjectId || loading}>
                  Generar certificado PDF
                </button>
              </div>
              {loading && <div className="text-xs text-slate-500">Cargando miembros...</div>}
              {selectedProject && (
                <div className="text-xs text-slate-500">
                  Participantes: {members.length} · Código: {selectedProject.invite_code || "N/A"}
                </div>
              )}
            </div>

            {selectedProject && (
              <div className="mt-6 rounded-2xl border p-4 bg-white shadow-sm space-y-2 text-xs">
                <div className="text-sm font-semibold">Preview del equipo</div>
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 pb-2">
                    <div>{m.name || "Sin nombre"}</div>
                    <div className="text-slate-500">{m.email}</div>
                  </div>
                ))}
                {members.length === 0 && <div className="text-xs text-slate-500">Sin miembros.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminNotificationsPage({ auth, onLogout }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const userId = auth.userId;

  const unreadCount = items.filter((n) => !n.read_at).length;

  async function load() {
    if (!userId) return;
    setMessage("");
    setLoading(true);
    try {
      const data = await apiGet(`/notifications?userId=${userId}`);
      setItems(data);
    } catch (err: any) {
      setMessage(err.message || "Error cargando notificaciones");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await apiPost(`/notifications/${id}/read`, {});
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)));
      return true;
    } catch (err: any) {
      setMessage(err.message || "Error marcando notificacion");
      return false;
    }
  }

  async function review(id: string) {
    const ok = await markRead(id);
    if (!ok) return;
    navigate("/admin/tasks");
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Notificaciones" message={message} onLogout={onLogout} userId={userId} />

            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Bandeja de admin</div>
                  <div className="text-xs text-slate-500">{unreadCount} sin leer - {items.length} totales</div>
                </div>
                <button className="px-3 py-2 rounded-xl border text-xs" onClick={load} disabled={loading || !userId}>
                  {loading ? "Cargando..." : "Actualizar"}
                </button>
              </div>

              {!userId && <div className="text-xs text-slate-500">Sin usuario de admin.</div>}

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {!loading &&
                  items.map((n) => (
                    <div key={n.id} className="rounded-xl border p-3 text-sm space-y-2 bg-slate-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900">{n.type}</div>
                        <div className={`text-[11px] px-2 py-1 rounded-full ${n.read_at ? "bg-slate-200 text-slate-700" : "bg-indigo-100 text-indigo-700"}`}>
                          {n.read_at ? "Leida" : "Nueva"}
                        </div>
                      </div>
                      <div className="text-slate-700">{n.message}</div>
                      <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</div>
                      {!n.read_at && (
                        <div className="flex flex-wrap gap-3 pt-1 text-xs">
                          <button className="text-indigo-600" onClick={() => review(n.id)}>
                            Revisar tarea
                          </button>
                          <button className="text-slate-600" onClick={() => markRead(n.id)}>
                            Marcar leida
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                {loading && <div className="text-xs text-slate-500">Cargando notificaciones...</div>}
                {!loading && items.length === 0 && <div className="text-sm text-slate-500">Sin notificaciones.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminHeader({ title, message, onLogout, userId }: { title: string; message?: string; onLogout: () => void; userId?: string }) {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-white/80">Panel administrador</div>
          <div className="text-2xl font-semibold">{title}</div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap flex-nowrap pb-1">
          <NavLink to="/admin" end className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/tasks" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Gestión de tareas
          </NavLink>
          <NavLink to="/admin/metrics" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Métricas
          </NavLink>
          <NavLink to="/admin/trl" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Dashboard TRL
          </NavLink>
          <NavLink to="/admin/campus-status" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Status por sede
          </NavLink>
          <NavLink to="/admin/reports" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Reportes
          </NavLink>
          <NavLink to="/admin/certificates" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Certificados
          </NavLink>
          <NavLink to="/admin/leaderboard" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Leaderboard
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Usuarios
          </NavLink>
          <NavLink to="/admin/notifications" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabIdle}`}>
            Notificaciones
          </NavLink>
          <button className={`${tabBase} ${tabIdle}`} onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
      {message && <div className="mt-3 text-xs text-white/90">{message}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MetricList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div className="text-xs text-slate-500 mb-2">{title}</div>
      <div className="space-y-2 text-xs">
        {items.length === 0 && <div className="text-slate-400">Sin datos</div>}
        {items.map((item) => {
          const value = Number(item.value || 0);
          const width = `${Math.max(3, Math.round((value / max) * 100))}%`;
          return (
          <div key={`${title}-${item.label}`} className="grid grid-cols-[minmax(0,1.15fr)_minmax(72px,1fr)_auto] items-center gap-2">
            <span className="min-w-0 text-slate-600 leading-tight">{item.label}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width }} />
            </div>
            <span className="shrink-0 text-right font-semibold text-slate-900">{value}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function OdsImpactChart({ items }: { items: { label: string; value: number }[] }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  const scaleMax = Math.max(5, Math.ceil(maxValue / 5) * 5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(scaleMax * ratio));

  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div>
        <div className="text-xs text-slate-500">Proyectos por ODS impactado</div>
        <div className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">
          Número de proyectos que impactan cada Objetivo de Desarrollo Sostenible según los ODS seleccionados por los equipos.
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        {items.length === 0 && <div className="text-slate-400">Sin datos</div>}
        {items.map((item) => {
          const value = Number(item.value || 0);
          const width = value ? `${Math.max(2, Math.round((value / scaleMax) * 100))}%` : "0%";
          return (
            <div key={`ods-impact-${item.label}`} className="grid grid-cols-[64px_minmax(0,1fr)_36px] items-center gap-3">
              <div className="text-right text-slate-600">{item.label}</div>
              <div
                className="relative h-2.5 overflow-hidden rounded-full bg-slate-100"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, transparent 0%, transparent 24%, rgba(148,163,184,0.22) 24.5%, transparent 25%, transparent 49%, rgba(148,163,184,0.22) 49.5%, transparent 50%, transparent 74%, rgba(148,163,184,0.22) 74.5%, transparent 75%)",
                }}
              >
                <div className="h-full rounded-full bg-blue-600" style={{ width }} />
              </div>
              <div className="text-right text-xs font-semibold text-slate-900">{value}</div>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)_36px] items-center gap-3 text-[11px] text-slate-400">
          <div />
          <div className="flex justify-between">
            {ticks.map((tick, index) => (
              <span key={`ods-tick-${index}`}>{tick}</span>
            ))}
          </div>
          <div />
        </div>
      )}
    </div>
  );
}

function MetricBarList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div className="text-xs text-slate-500 mb-3">{title}</div>
      <div className="space-y-3 text-xs">
        {items.length === 0 && <div className="text-slate-400">Sin datos</div>}
        {items.map((item) => {
          const value = Number(item.value || 0);
          const width = `${Math.max(3, Math.round((value / max) * 100))}%`;
          return (
            <div key={`${title}-${item.label}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-slate-600">{item.label}</span>
                <span className="shrink-0 font-semibold text-slate-900">{value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function AddMemberForm({ onAdd }: { onAdd: (email: string, name: string) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <input className="border rounded-xl px-3 py-2 text-xs" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="border rounded-xl px-3 py-2 text-xs" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs"
        onClick={() => {
          if (email) onAdd(email, name);
          setEmail("");
          setName("");
        }}
      >
        Agregar miembro
      </button>
    </div>
  );
}

export function AdminLeaderboardPage({ auth, onLogout }: Props) {
  const [leaderboard, setLeaderboard] = useState<Project[]>([]);
  const [message, setMessage] = useState("");

  async function loadLeaderboard() {
    try {
      const data = await apiGet("/leaderboard");
      setLeaderboard(data);
    } catch (err: any) {
      setMessage(err.message || "Error cargando leaderboard");
    }
  }

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => [...leaderboard].sort((a, b) => (b.score || 0) - (a.score || 0)), [leaderboard]);

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Leaderboard" message={message} onLogout={onLogout} userId={auth.userId} />
            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-2">
              {rows.map((p, index) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b last:border-b-0 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-xs text-slate-500">{index + 1}.</div>
                    <div>
                      <div className="text-sm font-medium">{p.title}</div>
                      <div className="text-xs text-slate-500">{p.invite_code || "N/A"}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{p.score ?? 0} pts</div>
                </div>
              ))}
              {rows.length === 0 && <div className="text-sm text-slate-500">Sin datos.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPage({ auth, onLogout }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");

  async function loadUsers() {
    try {
      const data = await apiGet("/admin/users");
      setUsers(data);
    } catch (err: any) {
      setMessage(err.message || "Error cargando usuarios");
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Eliminar usuario ${email}?`)) return;
    await apiDelete(`/admin/users/${userId}`);
    await loadUsers();
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Gestión de usuarios" message={message} onLogout={onLogout} userId={auth.userId} />
            <div className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-b last:border-b-0 py-3">
                  <div>
                    <div className="font-medium">{u.name || "Sin nombre"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    <div className="text-[11px] text-slate-400">
                      {u.role} • {u.project_count ?? 0} proyectos
                    </div>
                  </div>
                  <button className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs" onClick={() => deleteUser(u.id, u.email)}>
                    Eliminar
                  </button>
                </div>
              ))}
              {users.length === 0 && <div className="text-sm text-slate-500">Sin usuarios.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminTrlDashboardPage({ auth, onLogout }: Props) {
  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-visible md:rounded-3xl md:shadow-md md:p-6">
          <div className="p-5 md:p-0">
            <AdminHeader title="Dashboard TRL" message="" onLogout={onLogout} userId={auth.userId} />
            <TrlDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}



