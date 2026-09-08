import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";

type Task = {
  id: string;
  title: string;
  description?: string;
  due_at?: string;
  category?: string | null;
  task_group?: string | null;
  submission_id?: string;
  submission_status?: string;
  submission_feedback?: string;
  submission_points?: number;
};

type Props = {
  projectId: string;
  userId: string;
};

export default function ProjectTasks({ projectId, userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [inputs, setInputs] = useState<Record<string, { url: string; comment: string }>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const groupedTasks = useMemo(() => {
    const map = new Map<string, Map<string, Task[]>>();
    for (const task of tasks) {
      if (!task.category) continue;
      const category = task.category;
      const group = task.task_group || "General";
      if (!map.has(category)) map.set(category, new Map());
      const groupMap = map.get(category)!;
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(task);
    }
    return Array.from(map.entries()).map(([category, groups]) => ({
      category,
      groups: Array.from(groups.entries()).map(([group, items]) => ({ group, items })),
    }));
  }, [tasks]);

  useEffect(() => {
    if (!groupedTasks.length) return;
    setOpenCategories((prev) => {
      const next = { ...prev };
      for (const section of groupedTasks) {
        if (next[section.category] === undefined) next[section.category] = true;
      }
      return next;
    });
  }, [groupedTasks]);

  async function loadTasks() {
    const data = await apiGet(`/projects/${projectId}/tasks`);
    setTasks(data);
  }

  useEffect(() => {
    if (projectId) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function submit(taskId: string) {
    const input = inputs[taskId] || { url: "", comment: "" };
    await apiPost(`/projects/${projectId}/tasks/${taskId}/submissions`, {
      submittedBy: userId,
      url: input.url || null,
      comment: input.comment || null,
    });
    setMessage("Tarea enviada.");
    await loadTasks();
  }

  return (
    <div className="space-y-4">
      {groupedTasks.map((section) => (
        <div key={section.category} className="space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setOpenCategories((prev) => ({ ...prev, [section.category]: !prev[section.category] }))}
          >
            <span>{section.category}</span>
            <span className="text-xs text-slate-500">{openCategories[section.category] ? "Ocultar" : "Ver tareas"}</span>
          </button>
          {openCategories[section.category] &&
            section.groups.map((group) => (
              <div key={`${section.category}-${group.group}`} className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">{group.group}</div>
                {group.items.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-slate-500">{task.due_at ? new Date(task.due_at).toLocaleString() : "Sin fecha"}</div>
                    </div>
                    {task.description && <div className="text-sm text-slate-600">{task.description}</div>}
                    {task.submission_status ? (
                      <div className="text-xs text-slate-500">
                        Estado: {task.submission_status}
                        {typeof task.submission_points === "number" ? ` - Puntos: ${task.submission_points}` : ""}
                        {task.submission_feedback ? ` - Obs: ${task.submission_feedback}` : ""}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          className="border rounded px-2 py-1 text-sm w-full"
                          placeholder="URL de entrega (opcional)"
                          value={inputs[task.id]?.url || ""}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [task.id]: { ...prev[task.id], url: e.target.value } }))}
                        />
                        <textarea
                          className="border rounded px-2 py-1 text-sm w-full"
                          placeholder="Comentario (opcional)"
                          value={inputs[task.id]?.comment || ""}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [task.id]: { ...prev[task.id], comment: e.target.value } }))}
                        />
                        <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={() => submit(task.id)}>
                          Enviar tarea
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      ))}
      {tasks.length === 0 && <div className="text-sm text-slate-500">No hay tareas asignadas.</div>}
      {message && <div className="text-xs text-slate-600">{message}</div>}
    </div>
  );
}
