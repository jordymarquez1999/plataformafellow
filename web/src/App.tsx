import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Crown, Flame, Link as LinkIcon, Share2, Star, Trophy, Upload } from "lucide-react";
import LoginScreen from "./components/auth/LoginScreen";
import ProjectOnboardingScreen from "./components/auth/ProjectOnboardingScreen";
import AdminDashboard, {
  AdminCertificatesPage,
  AdminCampusStatusPage,
  AdminLeaderboardPage,
  AdminMetricsPage,
  AdminNotificationsPage,
  AdminProjectReportsPage,
  AdminTasksPage,
  AdminTrlDashboardPage,
  AdminUsersPage,
} from "./components/admin/AdminDashboard";
import NotificationsPanel from "./components/common/NotificationsPanel";
import ReservationsCalendar from "./components/common/ReservationsCalendar";
import { apiGet, apiPost } from "./lib/api";
import "./index.css";

type AuthState = {
  userId?: string;
  projectId?: string;
  inviteCode?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  role?: "admin" | "student";
  name?: string;
  avatarUrl?: string;
};

type TaskItem = {
  id: string;
  title: string;
  description?: string;
  due_at?: string;
  scope?: "global" | "project";
  category?: string | null;
  task_group?: string | null;
  icon_key?: string | null;
  submission_id?: string | null;
  submission_status?: string | null;
  submission_feedback?: string | null;
  submission_points?: number | null;
  submission_created_at?: string | null;
  submission_submitted_by?: string | null;
  submission_submitter_name?: string | null;
  submission_submitter_email?: string | null;
};

type ProjectInfo = {
  id?: string;
  title?: string;
  invite_code?: string;
  score?: number;
};

type LeaderRow = { id: string; title: string; invite_code?: string; score?: number };

function useLocal<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [key, state]);

  return [state, setState] as const;
}

const TASK_COLORS = [
  "from-indigo-500 to-blue-500",
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-500",
  "from-rose-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-purple-500 to-indigo-500",
  "from-amber-500 to-pink-500",
  "from-sky-500 to-indigo-500",
];

const TASK_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  star: Star,
  flame: Flame,
  crown: Crown,
  trophy: Trophy,
  check: CheckCircle2,
  upload: Upload,
};

function colorForTaskId(id: string) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return TASK_COLORS[sum % TASK_COLORS.length];
}

export default function App() {
  const [auth, setAuth] = useLocal<AuthState>("ff_auth", {});
  const isApproved = auth.role === "admin" || auth.approvalStatus === "approved";

  return (
    <Routes>
      <Route
        path="/"
        element={
          !isApproved ? (
            <LoginScreen
              onLoginSuccess={(p) =>
                setAuth({
                  userId: p.userId,
                  projectId: p.projectId,
                  inviteCode: p.inviteCode,
                  approvalStatus: p.approvalStatus as any,
                  role: p.role as any,
                  name: (p as any).name,
                  avatarUrl: (p as any).avatarUrl,
                })
              }
            />
          ) : auth.role === "admin" ? (
            <Navigate to="/admin" replace />
          ) : (
            <StudentDashboard auth={auth} onLogout={() => setAuth({})} />
          )
        }
      />
      <Route path="/onboarding" element={isApproved ? <Navigate to="/" replace /> : <ProjectOnboardingScreen setAuth={setAuth} />} />
      <Route path="/admin" element={auth.role === "admin" ? <AdminDashboard auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/tasks" element={auth.role === "admin" ? <AdminTasksPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/metrics" element={auth.role === "admin" ? <AdminMetricsPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/trl" element={auth.role === "admin" ? <AdminTrlDashboardPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/campus-status" element={auth.role === "admin" ? <AdminCampusStatusPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/reports" element={auth.role === "admin" ? <AdminProjectReportsPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/certificates" element={auth.role === "admin" ? <AdminCertificatesPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/leaderboard" element={auth.role === "admin" ? <AdminLeaderboardPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/users" element={auth.role === "admin" ? <AdminUsersPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="/admin/notifications" element={auth.role === "admin" ? <AdminNotificationsPage auth={auth} onLogout={() => setAuth({})} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function StudentDashboard({
  auth,
  onLogout,
}: {
  auth: AuthState;
  onLogout: () => void;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [view, setView] = useLocal<{ screen: "home" | "detail"; taskId: string | null }>("ff_view", { screen: "home", taskId: null });

  const progressPct = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.submission_status === "submitted" || t.submission_status === "reviewed").length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const streak = useMemo(() => {
    const days = new Set(tasks.filter((t) => t.submission_created_at).map((t) => new Date(t.submission_created_at || 0).toDateString()));
    return Math.min(days.size, 5);
  }, [tasks]);

  const points = project?.score || 0;

  useEffect(() => {
    async function load() {
      if (!auth.projectId) return;
      const [projectData, tasksData, leaderboardData] = await Promise.all([
        apiGet(`/projects/${auth.projectId}`),
        apiGet(`/projects/${auth.projectId}/tasks`),
        apiGet("/leaderboard"),
      ]);
      setProject(projectData);
      setTasks(tasksData);
      setLeaderboard(leaderboardData);
    }
    load();
  }, [auth.projectId]);

  useEffect(() => {
    if (view.screen !== "home" && view.screen !== "detail") {
      setView({ screen: "home", taskId: null });
    }
  }, [view.screen, setView]);

  function openTask(taskId: string) {
    setView({ screen: "detail", taskId });
  }

  function backHome() {
    setView({ screen: "home", taskId: null });
  }

  return (
    <div className="min-h-screen bg-[#EEE9FF] p-4 text-slate-900">
      <div className="mx-auto w-full max-w-md md:max-w-6xl">
        <div className="rounded-[32px] bg-white shadow-xl overflow-hidden md:rounded-3xl md:shadow-md md:p-6">
          {view.screen === "home" ? (
            <HomeScreen
              progressPct={progressPct}
              streak={streak}
              tasks={tasks}
              points={points}
              leaderboard={leaderboard}
              inviteCode={project?.invite_code || auth.inviteCode}
              displayName={auth.name}
              avatarUrl={auth.avatarUrl}
              userId={auth.userId}
              projectId={auth.projectId}
              onLogout={onLogout}
              onOpen={openTask}
            />
          ) : (
            <DetailScreen
              task={tasks.find((t) => t.id === view.taskId)}
              projectId={auth.projectId}
              userId={auth.userId}
              onBack={backHome}
              onSubmitted={async () => {
                if (!auth.projectId) return;
                const rows = await apiGet(`/projects/${auth.projectId}/tasks`);
                setTasks(rows);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HomeScreen({
  displayName,
  avatarUrl,
  progressPct,
  streak,
  tasks,
  points,
  leaderboard,
  inviteCode,
  userId,
  projectId,
  onLogout,
  onOpen,
}: {
  displayName?: string;
  avatarUrl?: string;
  progressPct: number;
  streak: number;
  tasks: TaskItem[];
  points: number;
  leaderboard: LeaderRow[];
  inviteCode?: string;
  userId?: string;
  projectId?: string;
  onLogout: () => void;
  onOpen: (id: string) => void;
}) {
  const widthPct = Math.min(100, progressPct);
  const leaderboardRows = useMemo(() => [...leaderboard].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6), [leaderboard]);
  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || "Student")}`;
  const avatarSrc = avatarUrl || fallbackAvatar;
  const tasksByCategory = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const categoryKey = task.category || "Sin categoría";
      if (!map.has(categoryKey)) map.set(categoryKey, []);
      map.get(categoryKey)!.push(task);
    }
    return Array.from(map.entries()).map(([category, items]) => {
      const completed = items.filter((t) => t.submission_status === "submitted" || t.submission_status === "reviewed").length;
      return { category, items, completed, total: items.length };
    });
  }, [tasks]);
  const [openTouchpointCategories, setOpenTouchpointCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tasksByCategory.length) return;
    setOpenTouchpointCategories((prev) => {
      const next = { ...prev };
      for (const section of tasksByCategory) {
        if (next[section.category] === undefined) next[section.category] = true;
      }
      return next;
    });
  }, [tasksByCategory]);
  return (
    <div className="p-5 md:p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <img
            src={avatarSrc}
            className="w-10 h-10 rounded-full"
            alt="Avatar"
          />
          <div>
            <div className="text-sm text-slate-500">Hola,</div>
            <div className="font-semibold -mt-1">{displayName || "Tu nombre"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 rounded-xl bg-slate-100 text-xs text-slate-600">Código: {inviteCode || "N/A"}</div>
          <div className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs">{points} pts</div>
          <button className="rounded-xl border px-3 py-1 text-xs text-slate-600" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="rounded-3xl border-0 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-2xl bg-white/15 p-3">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold">Racha de práctica</div>
                  <div className="text-sm text-white/90">{streak} días seguidos</div>
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                      <div className="h-2 bg-white" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="text-xs mt-1 text-white/90">{progressPct}% de 8 entregas</div>
                  </div>
                </div>
                <button className="rounded-xl bg-white/20 text-white px-3 py-1 text-xs hidden md:inline-flex">Ver más</button>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs text-slate-600 mb-2">
              Este calendario es para que puedas solicitar asesorías personalizadas en el Fab Lab. Revisa la fecha y envía tu solicitud para que esta sea aprobada por el administrador.
            </div>
            <ReservationsCalendar mode="student" projectId={projectId} />
          </div>
        </div>

        <div className="md:col-span-7">
          <div className="rounded-2xl p-4 bg-slate-50 border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 grid place-items-center">
              <Crown className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Tu siguiente entregable</div>
              <div className="text-xs text-slate-500">Termina cualquiera para sumar puntos</div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-2 bg-indigo-500" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
            <button className="rounded-xl bg-indigo-600 text-white px-3 py-1 text-xs">Continuar</button>
          </div>

          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Leaderboard</div>
              <div className="text-xs text-slate-500">Top equipos</div>
            </div>
            <div className="space-y-2">
              {leaderboardRows.map((row, index) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 text-xs text-slate-400">{index + 1}.</div>
                    <div className="font-medium truncate max-w-[180px]">{row.title}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-700">{row.score || 0} pts</div>
                </div>
              ))}
              {leaderboardRows.length === 0 && <div className="text-xs text-slate-500">Sin datos de equipos.</div>}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Touchpoints</div>
              <div className="text-sm text-slate-500">Popular</div>
            </div>
            {tasksByCategory.length === 0 ? (
              <div className="text-sm text-slate-500">Aún no hay tareas asignadas.</div>
            ) : (
              <div className="space-y-3">
                {tasksByCategory.map((section) => (
                  <div key={section.category} className="space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-slate-700 bg-white"
                      onClick={() =>
                        setOpenTouchpointCategories((prev) => ({
                          ...prev,
                          [section.category]: !prev[section.category],
                        }))
                      }
                    >
                      <span className="font-semibold">{section.category}</span>
                      <span className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className={`h-2.5 w-2.5 rounded-full ${section.completed === section.total ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                        <span>{section.completed}/{section.total}</span>
                        <span>{openTouchpointCategories[section.category] ? "Ocultar" : "Despliega para ver tus tareas"}</span>
                      </span>
                    </button>
                    {openTouchpointCategories[section.category] && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {section.items.map((task) => (
                          <TaskCardMini key={task.id} task={task} color={colorForTaskId(task.id)} onClick={() => onOpen(task.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold mb-2">Notificaciones</div>
              {userId ? <NotificationsPanel userId={userId} /> : <div className="text-xs text-slate-500">Sin usuario.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden mt-4">
        <div className="text-xs text-slate-600 mb-2">
          Este calendario es para que puedas solicitar asesorías personalizadas en el Fab Lab. Revisa la fecha y envía tu solicitud para que esta sea aprobada por el administrador.
        </div>
        <ReservationsCalendar mode="student" projectId={projectId} />
      </div>
    </div>
  );
}

function TaskCardMini({ task, color, onClick }: { task: TaskItem; color: string; onClick: () => void }) {
  const status = task.submission_status;
  const badgeClass =
    status === "reviewed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "submitted"
        ? "bg-indigo-100 text-indigo-800"
        : "bg-slate-100 text-slate-700";
  const label = status === "reviewed" ? "Revisado" : status === "submitted" ? "Enviado" : "Pendiente";
  const submitterLabel = task.submission_submitter_name || task.submission_submitter_email;
  const Icon = (task.icon_key && TASK_ICON_MAP[task.icon_key]) || Star;

  return (
    <button onClick={onClick} className="text-left rounded-3xl p-4 shadow-sm bg-white border hover:shadow-md transition">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${color} grid place-items-center mb-2`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="font-medium leading-tight">{task.title}</div>
      {task.description && <div className="text-[12px] text-slate-500 line-clamp-2">{task.description}</div>}
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${badgeClass}`}>{label}</span>
        {status === "reviewed" && typeof task.submission_points === "number" && (
          <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] bg-amber-100 text-amber-800">
            {task.submission_points} pts
          </span>
        )}
      </div>
      {status && submitterLabel && <div className="mt-2 text-[11px] text-slate-500">Enviado por {submitterLabel}</div>}
    </button>
  );
}

function DetailScreen({
  task,
  projectId,
  userId,
  onBack,
  onSubmitted,
}: {
  task?: TaskItem;
  projectId?: string;
  userId?: string;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [link, setLink] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!task) {
    return (
      <div className="p-5">
        <button className="rounded-full p-2 hover:bg-slate-100" onClick={onBack}>
          <ArrowLeft className="w-5" />
        </button>
        <div className="text-sm text-slate-500 mt-4">Tarea no encontrada.</div>
      </div>
    );
  }

  const color = colorForTaskId(task.id);
  const Icon = (task.icon_key && TASK_ICON_MAP[task.icon_key]) || Star;
  const updatedText = task.submission_created_at
    ? `Última entrega: ${new Date(task.submission_created_at).toLocaleString()}`
    : "Aún no enviado";
  const submitterLabel = task.submission_submitter_name || task.submission_submitter_email;

  async function submit() {
    setMessage("");
    if (!projectId || !userId) {
      setMessage("Falta proyecto o usuario.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/projects/${projectId}/tasks/${task.id}/submissions`, {
        submittedBy: userId,
        url: link || null,
        comment: comment || null,
      });
      setLink("");
      setComment("");
      setMessage("Enviado.");
      await onSubmitted();
    } catch (err: any) {
      setMessage(err.message || "Error al enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <button className="rounded-full p-2 hover:bg-slate-100" onClick={onBack}>
          <ArrowLeft className="w-5" />
        </button>
        <div className="font-semibold">{task.title}</div>
      </div>

      <div className="border-0 rounded-3xl overflow-hidden shadow-md bg-white">
        <div className={`h-32 bg-gradient-to-r ${color}`} />
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{task.title}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Icon className="w-4" /> {task.scope === "global" ? "Global" : "Por proyecto"}
            </div>
          </div>
          {task.description && <p className="text-sm text-slate-600">{task.description}</p>}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 text-slate-500" />
              <input
                className="h-10 rounded-xl border px-3 text-sm w-full"
                placeholder="Pega tu enlace"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
            <textarea
              className="min-h-[100px] rounded-xl border px-3 py-2 text-sm w-full"
              placeholder="Comentario (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 justify-between pt-2">
            <div className="text-xs text-slate-500">
              {updatedText}
              {task.submission_status && submitterLabel ? ` • Enviado por ${submitterLabel}` : ""}
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl border px-3 py-1 text-xs flex items-center gap-1">
                <Share2 className="w-4" /> Compartir
              </button>
              <button className="rounded-xl bg-indigo-600 text-white px-3 py-1 text-xs flex items-center gap-1" onClick={submit} disabled={busy}>
                <Upload className="w-4" /> Enviar
              </button>
            </div>
          </div>
          {message && <div className="text-xs text-slate-500">{message}</div>}
        </div>
      </div>

      {task.submission_status === "reviewed" && (
        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-emerald-700 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4" /> Revisado por el admin.
          </div>
          {typeof task.submission_points === "number" && <div>Puntos: {task.submission_points}</div>}
          {task.submission_feedback && <div>Feedback: {task.submission_feedback}</div>}
        </div>
      )}
    </div>
  );
}





