declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_API_URL?: string;
      VITE_GOOGLE_CLIENT_ID?: string;
    };
  }
}

const API_BASE = window.__APP_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || "";

function withYear(url: string, year?: number) {
  if (!year) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}year=${encodeURIComponent(String(year))}`;
}

async function handleJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

export async function actualizarDatos() {
  const res = await fetch(`${API_BASE}/admin/trl/actualizar-datos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleJson(res);
}

export async function getMetricasPrincipales(year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/metricas-principales`, year));
  return handleJson(res);
}

export async function getGraficosData(year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/datos-graficos`, year));
  return handleJson(res);
}

export async function getInsightsGenerales(year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/insights-generales`, year));
  return handleJson(res);
}

export async function obtenerProyectos(year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/proyectos`, year));
  const data = await handleJson(res);
  return data.proyectos || [];
}

export async function forzarAprobacion(nombre: string, year?: number, force = true) {
  const res = await fetch(`${API_BASE}/admin/trl/forzar-aprobacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, year, force }),
  });
  return handleJson(res);
}

export async function eliminarProyectoTrl(nombre: string, year?: number) {
  const res = await fetch(`${API_BASE}/admin/trl/eliminar-proyecto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, year }),
  });
  return handleJson(res);
}

export async function obtenerProyectosEliminados(year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/proyectos-eliminados`, year));
  const data = await handleJson(res);
  return data.proyectos || [];
}

export async function restablecerProyectoTrl(nombre: string, year?: number) {
  const res = await fetch(`${API_BASE}/admin/trl/restablecer-proyecto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, year }),
  });
  return handleJson(res);
}

export async function migrarProyectoTrl(nombre: string, fromYear: number, toYear: number, entryId?: string) {
  const res = await fetch(`${API_BASE}/admin/trl/migrar-proyecto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, fromYear, toYear, entryId }),
  });
  return handleJson(res);
}

export async function enviarCorreoTrl(correo: string, proyecto: string, year?: number) {
  const res = await fetch(`${API_BASE}/admin/trl/enviar-correo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, proyecto, year }),
  });
  return handleJson(res);
}

export async function buscarProyecto(nombre: string, year?: number) {
  const res = await fetch(withYear(`${API_BASE}/admin/trl/buscar-proyecto`, year), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.proyectos || [];
}

export function generarReporteProyecto(nombre: string, year?: number) {
  const url = withYear(`${API_BASE}/admin/trl/reporte-proyecto/${encodeURIComponent(nombre)}`, year);
  const win = window.open(url, "_blank");
  if (win) win.focus();
}

export function descargarReporteAprobados(year?: number) {
  const url = withYear(`${API_BASE}/admin/trl/reporte-aprobados`, year);
  const win = window.open(url, "_blank");
  if (win) win.focus();
}

export function descargarReporteTop10(year?: number) {
  const url = withYear(`${API_BASE}/admin/trl/reporte-top10`, year);
  const win = window.open(url, "_blank");
  if (win) win.focus();
}
