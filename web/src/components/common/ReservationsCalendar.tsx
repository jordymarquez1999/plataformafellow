import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "../../lib/api";

type Reservation = {
  id: string;
  project_id?: string | null;
  start_at: string;
  end_at: string;
  status: string;
  notes?: string | null;
  title?: string | null;
};

type Props = {
  mode: "student" | "admin";
  projectId?: string;
  userId?: string;
  title?: string;
};

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ReservationsCalendar({ mode, projectId, userId, title = "Calendario FabLab" }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => buildMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const slots = useMemo(() => buildSlots(), []);

  const dayReservations = useMemo(() => {
    if (!selectedDate) return [];
    return reservations.filter((r) => sameDay(selectedDate, new Date(r.start_at)));
  }, [reservations, selectedDate]);

  const reservedDays = useMemo(() => {
    const map = new Set<string>();
    for (const r of reservations) {
      map.add(new Date(r.start_at).toDateString());
    }
    return map;
  }, [reservations]);

  async function load() {
    const rows = await apiGet("/reservations?status=active");
    setReservations(rows);
  }

  useEffect(() => {
    load();
  }, []);

  function prev() {
    const m = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(m.getFullYear());
    setViewMonth(m.getMonth());
  }

  function next() {
    const m = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(m.getFullYear());
    setViewMonth(m.getMonth());
  }

  async function submit() {
    setMessage("");
    if (!selectedDate || !startTime || !endTime) {
      setMessage("Selecciona fecha y horario.");
      return;
    }
    if (endTime <= startTime) {
      setMessage("El horario de fin debe ser posterior al inicio.");
      return;
    }
    if (mode === "student" && !projectId) {
      setMessage("Falta proyecto para reservar.");
      return;
    }
    const startAt = combineDateTime(selectedDate, startTime);
    const endAt = combineDateTime(selectedDate, endTime);
    setBusy(true);
    try {
      if (mode === "admin") {
        await apiPost("/admin/reservations/block", {
          startAt,
          endAt,
          notes,
          adminId: userId || null,
        });
      } else {
        await apiPost(`/projects/${projectId}/reservations`, {
          startAt,
          endAt,
          notes,
        });
      }
      setNotes("");
      setStartTime("");
      setEndTime("");
      await load();
      setMessage(mode === "admin" ? "Bloqueo guardado." : "Solicitud enviada.");
    } catch (err: any) {
      setMessage(err.message || "Error al enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function unblockReservation(id: string) {
    if (mode !== "admin") return;
    setMessage("");
    setBusy(true);
    try {
      await apiDelete(`/admin/reservations/${id}`);
      await load();
      setMessage("Horario desbloqueado.");
    } catch (err: any) {
      setMessage(err.message || "Error al desbloquear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 text-indigo-600" />
          <div className="font-medium">{title}</div>
          {message && <div className="ml-auto text-xs text-slate-600">{message}</div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <button className="h-8 w-8 rounded-lg border grid place-items-center" onClick={prev}>
                <ChevronLeft className="w-4" />
              </button>
              <div className="font-medium">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <button className="h-8 w-8 rounded-lg border grid place-items-center" onClick={next}>
                <ChevronRight className="w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 text-[11px] text-slate-500 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, idx) => {
                const disabled = !d.inMonth || d.date < new Date(new Date().toDateString());
                const hasReservation = reservedDays.has(d.date.toDateString());
                const isSelected = selectedDate && sameDay(selectedDate, d.date);
                return (
                  <button
                    key={idx}
                    disabled={disabled}
                    onClick={() => setSelectedDate(d.date)}
                    className={`h-9 rounded-lg text-sm ${
                      !d.inMonth ? "text-slate-300" : "text-slate-700"
                    } ${isSelected ? "bg-indigo-600 text-white" : "hover:bg-slate-100"} ${
                      hasReservation && !isSelected ? "ring-2 ring-indigo-200" : ""
                    } disabled:opacity-30`}
                  >
                    {d.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">{selectedDate ? selectedDate.toLocaleDateString() : "Selecciona una fecha"}</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="border rounded-xl px-3 py-2 text-sm w-full" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                <option value="">Inicio</option>
                {slots.map((s) => (
                  <option key={`start-${s}`} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select className="border rounded-xl px-3 py-2 text-sm w-full" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                <option value="">Fin</option>
                {slots.map((s) => (
                  <option key={`end-${s}`} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="border rounded-xl px-3 py-2 text-sm w-full min-h-[80px]"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              className={`rounded-xl px-3 py-2 text-sm ${busy ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white"}`}
              disabled={busy}
              onClick={submit}
            >
              {mode === "admin" ? "Bloquear horario" : "Solicitar reserva"}
            </button>

            <div className="rounded-xl border p-3 text-xs space-y-2">
              <div className="font-medium">Ocupado (dia seleccionado)</div>
              {dayReservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="font-semibold">
                    {formatTime(r.start_at)} - {formatTime(r.end_at)}
                  </div>
                  <div className="text-slate-500 flex items-center gap-2">
                    <span>
                      {r.status}
                      {r.title ? ` - ${r.title}` : ""}
                    </span>
                    {mode === "admin" && r.status === "blocked" && (
                      <button className="text-indigo-600" onClick={() => unblockReservation(r.id)}>
                        Desbloquear
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {dayReservations.length === 0 && <div className="text-slate-500">Sin reservas.</div>}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3" /> Las reservas se muestran como ocupadas hasta aprobación.
        </div>
      </div>
    </div>
  );
}

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startIdx = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = 42;
  const result: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < cells; i++) {
    const dayNum = i - startIdx + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const d = new Date(year, month, inMonth ? dayNum : dayNum < 1 ? 0 : daysInMonth + 1);
    if (!inMonth) {
      if (dayNum < 1) {
        d.setDate(dayNum + 1);
        d.setMonth(month);
        d.setFullYear(year);
        d.setDate(0);
      } else {
        d.setFullYear(year);
        d.setMonth(month + 1);
        d.setDate(dayNum - daysInMonth);
      }
    }
    result.push({ date: d, inMonth });
  }
  return result;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function buildSlots() {
  const arr: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      arr.push(`${hh}:${mm}`);
    }
  }
  return arr;
}

function combineDateTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

function formatTime(value: string) {
  const d = new Date(value);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
