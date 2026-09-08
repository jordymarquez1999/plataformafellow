import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandingPanel from "./BrandingPanel";
import LoginLayout from "./LoginLayout";
import { apiPost } from "../../lib/api";

type Props = {
  setAuth: (v: any) => void;
};

export default function ProjectOnboardingScreen({ setAuth }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [researchLine, setResearchLine] = useState("");
  const [selectedOds, setSelectedOds] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [career, setCareer] = useState("");
  const [cycle, setCycle] = useState("");
  const [campus, setCampus] = useState("");
  const [responsibilitySelections, setResponsibilitySelections] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const submitLock = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get("mode");
  const [activeMode, setActiveMode] = useState<"new" | "join">(mode === "join" ? "join" : "new");

  const researchLines = [
    { label: "Cambio climático", ods: ["ODS 13", "ODS 11", "ODS 2"] },
    { label: "Energías renovables", ods: ["ODS 7"] },
    { label: "Tecnologías para la educación", ods: ["ODS 4", "ODS 3", "ODS 1", "ODS 17"] },
    { label: "Emprendedurismo e innovación", ods: ["ODS 9", "ODS 17"] },
    { label: "Salud pública", ods: ["ODS 3"] },
    { label: "Gestión y políticas públicas", ods: ["ODS 3", "ODS 5", "ODS 8", "ODS 10", "ODS 1"] },
  ];

  const industries = [
    "Tecnologías Digitales y de la Información",
    "Innovación en Ingeniería y Tecnología",
    "Innovación y Gestión Empresarial",
    "Ciencias de la Salud y Biotecnología",
    "Sostenibilidad y Medio Ambiente",
    "Proyectos Sociales y Comunitarios",
  ];

  const campusOptions = [
    { value: "arequipa", label: "Arequipa" },
    { value: "huancayo", label: "Huancayo" },
    { value: "ica", label: "Ica" },
    { value: "lima", label: "Lima" },
    { value: "ayacucho", label: "Ayacucho" },
    { value: "cusco", label: "Cusco" },
  ];

  const cycleOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  const careerOptions = [
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

  const odsGlossary = [
    { key: "ODS 1", label: "Fin de la pobreza" },
    { key: "ODS 2", label: "Hambre cero" },
    { key: "ODS 3", label: "Salud y bienestar" },
    { key: "ODS 4", label: "Educación de calidad" },
    { key: "ODS 5", label: "Igualdad de género" },
    { key: "ODS 7", label: "Energía asequible y no contaminante" },
    { key: "ODS 8", label: "Trabajo decente y crecimiento económico" },
    { key: "ODS 9", label: "Industria, innovación e infraestructura" },
    { key: "ODS 10", label: "Reducción de las desigualdades" },
    { key: "ODS 11", label: "Ciudades y comunidades sostenibles" },
    { key: "ODS 13", label: "Acción por el clima" },
    { key: "ODS 17", label: "Alianzas para lograr los objetivos" },
  ];

  const responsibilityOptions = [
    "Conceptualización",
    "Metodología",
    "Software",
    "Validación",
    "Análisis Formal",
    "Investigación",
    "Recursos",
    "Curaduría de Datos",
    "Redacción - Borrador Original",
    "Redacción - Revisión y Edición",
    "Visualización",
    "Supervisión",
    "Administración del Proyecto",
    "Obtención de Financiación",
  ];

  const responsibilityDetails: Record<string, string> = {
    Conceptualización: "En el Fab Lab: El alumno, con la guía del Faber Tech, define la idea y los objetivos del proyecto.",
    Metodología: "En el Fab Lab: Diseño y planificación de los procesos de prototipado y fabricación.",
    Software: "En el Fab Lab: Desarrollo o adaptación de herramientas digitales para el diseño o control de equipos.",
    Validación: "En el Fab Lab: Verificación y pruebas de los prototipos fabricados.",
    "Análisis Formal": "En el Fab Lab: Técnicas de medición para evaluar rendimiento y funcionalidad del prototipo.",
    Investigación: "En el Fab Lab: Búsqueda de información, nuevas técnicas y experimentación práctica.",
    Recursos: "En el Fab Lab: Gestión de equipos, materiales, herramientas y espacios necesarios.",
    "Curaduría de Datos": "En el Fab Lab: Organización y respaldo de archivos y parámetros de fabricación.",
    "Redacción - Borrador Original": "En el Fab Lab: Elaboración del primer borrador técnico del documento.",
    "Redacción - Revisión y Edición": "En el Fab Lab: Revisión conjunta para precisión técnica y claridad.",
    Visualización: "En el Fab Lab: Gráficos, diagramas o material visual del proceso y prototipo.",
    Supervisión: "En el Fab Lab: Mentoría y supervisión en el uso de equipos y buenas prácticas.",
    "Administración del Proyecto": "En el Fab Lab: Coordinación de tiempos, recursos y actividades del proyecto.",
    "Obtención de Financiación": "En el Fab Lab: Gestión de apoyos económicos y subvenciones.",
  };

  const selectedResearchLine = researchLines.find((line) => line.label === researchLine) || null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ff_pending");
      if (!raw) return;
      const data = JSON.parse(raw) as { name?: string; email?: string; picture?: string };
      if (data?.name) setName(data.name);
      if (data?.email) setEmail(data.email);
      if (data?.picture) setAvatarUrl(data.picture);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (mode === "join") setActiveMode("join");
    if (mode === "new") setActiveMode("new");
  }, [mode]);

  useEffect(() => {
    setSelectedOds(selectedResearchLine?.ods || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchLine]);

  function toggleResponsibility(role: string) {
    setResponsibilitySelections((prev) => (prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]));
  }

  function toggleOds(ods: string) {
    setSelectedOds((prev) => (prev.includes(ods) ? prev.filter((item) => item !== ods) : [...prev, ods]));
  }

  async function handleRegisterNew() {
    if (submitLock.current) return;
    if (!name || !email || !projectTitle || !researchLine || selectedOds.length === 0 || !industry || !career || !cycle || !campus || responsibilitySelections.length === 0) {
      setMessage("Completa nombre, email, título, línea de investigación, ODS, industria, carrera, ciclo, sede y roles.");
      return;
    }
    submitLock.current = true;
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost("/auth/register", {
        name,
        email,
        projectTitle,
        researchLine,
        ods: selectedOds,
        industry,
        career,
        cycle,
        campus,
        responsibility: responsibilitySelections.join(", "),
      });
      setAuth({
        userId: data.userId,
        projectId: data.projectId,
        inviteCode: data.inviteCode,
        approvalStatus: data.approvalStatus,
        role: "student",
        name,
        avatarUrl: avatarUrl || undefined,
      });
      try {
        localStorage.removeItem("ff_pending");
        localStorage.setItem("ff_pending_request", "1");
      } catch {
        // ignore
      }
      navigate("/");
    } catch (err: any) {
      if (err.message === "already_registered") {
        try {
          localStorage.setItem("ff_pending_request", "1");
        } catch {
          // ignore
        }
        setAuth({});
        navigate("/");
        return;
      }
      setMessage(err.message || "Error al registrar proyecto");
    } finally {
      setLoading(false);
      submitLock.current = false;
    }
  }

  async function handleJoin() {
    if (submitLock.current) return;
    if (!name || !email) {
      setMessage("Necesitamos tu nombre y email. Inicia sesión con Google o vuelve a completar tus datos.");
      return;
    }
    if (!inviteCode || !career || !cycle || !campus || responsibilitySelections.length === 0) {
      setMessage("Completa código de proyecto, carrera, ciclo, sede y roles.");
      return;
    }
    submitLock.current = true;
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost("/auth/register", {
        name,
        email,
        inviteCode,
        career,
        cycle,
        campus,
        responsibility: responsibilitySelections.join(", "),
      });
      setAuth({
        userId: data.userId,
        projectId: data.projectId,
        inviteCode: data.inviteCode,
        approvalStatus: data.approvalStatus,
        role: "student",
        name,
        avatarUrl: avatarUrl || undefined,
      });
      try {
        localStorage.removeItem("ff_pending");
        localStorage.setItem("ff_pending_request", "1");
      } catch {
        // ignore
      }
      navigate("/");
    } catch (err: any) {
      if (err.message === "already_registered") {
        try {
          localStorage.setItem("ff_pending_request", "1");
        } catch {
          // ignore
        }
        setAuth({});
        navigate("/");
        return;
      }
      setMessage(err.message || "Error al unirte");
    } finally {
      setLoading(false);
      submitLock.current = false;
    }
  }

  return (
    <LoginLayout
      leftPanel={<BrandingPanel />}
      rightPanel={
        <div className="p-8 lg:p-12">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-xs uppercase tracking-wide">Configura tu proyecto</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mt-2">Datos del equipo</h2>
            <p className="text-muted-foreground text-sm">Crea un proyecto nuevo o únete con código.</p>
          </div>

          {message && <div className="mb-4 text-sm text-slate-200">{message}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                    activeMode === "new" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveMode("new")}
                >
                  Registrar proyecto
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                    activeMode === "join" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveMode("join")}
                >
                  Unirse con código
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {activeMode === "new" && (
                <div
                  className={`bg-card/70 border border-border rounded-xl p-3 space-y-2 ${
                    mode === "new" ? "ring-2 ring-indigo-500/60" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">Registrar nuevo proyecto</div>
                  <div className="text-[11px] text-muted-foreground">El líder del equipo es quien registra el proyecto.</div>
                  <input className="auth-input" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="auth-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input className="auth-input" placeholder="Título del proyecto" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
                  <select className="auth-input" value={researchLine} onChange={(e) => setResearchLine(e.target.value)}>
                    <option value="">Línea de investigación</option>
                    {researchLines.map((line) => (
                      <option key={line.label} value={line.label}>
                        {line.label}
                      </option>
                    ))}
                  </select>
                  {selectedResearchLine && (
                    <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700">ODS relacionados</div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedResearchLine.ods.map((ods) => {
                          const selected = selectedOds.includes(ods);
                          return (
                            <button
                              key={ods}
                              type="button"
                              onClick={() => toggleOds(ods)}
                              aria-pressed={selected}
                              className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition ${
                                selected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {ods}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Selecciona los ODS a los que apunta el proyecto.</div>
                    </div>
                  )}
                  <select className="auth-input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    <option value="">Tipo de industria</option>
                    {industries.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select className="auth-input" value={career} onChange={(e) => setCareer(e.target.value)}>
                    <option value="">Carrera</option>
                    {careerOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select className="auth-input" value={cycle} onChange={(e) => setCycle(e.target.value)}>
                    <option value="">Ciclo</option>
                    {cycleOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <select className="auth-input" value={campus} onChange={(e) => setCampus(e.target.value)}>
                    <option value="">Sede</option>
                    {campusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-muted-foreground">Roles en el equipo</div>
                  <div className="grid grid-cols-2 gap-2">
                    {responsibilityOptions.map((item) => {
                      const selected = responsibilitySelections.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleResponsibility(item)}
                          aria-pressed={selected}
                          className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition ${
                            selected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  {responsibilitySelections.length > 0 && (
                    <div className="space-y-2">
                      {responsibilitySelections.map((role) => (
                        <div key={role} className="rounded-lg border border-border bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                          <div className="text-[11px] font-semibold text-slate-700">{role}</div>
                          <div>{responsibilityDetails[role] || ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="w-full border rounded-lg py-2 text-sm" onClick={handleRegisterNew} disabled={loading}>
                    Enviar a aprobación
                  </button>
                </div>
                )}
                {activeMode === "join" && (
                <div
                  className={`bg-card/70 border border-border rounded-xl p-3 space-y-2 ${
                    mode === "join" ? "ring-2 ring-indigo-500/60" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">Unirme con código de equipo</div>
                  <div className="text-[11px] text-muted-foreground">
                    Usa el código que te comparte el líder para unirte al proyecto.
                  </div>
                  <input className="auth-input" placeholder="Código del proyecto" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
                  <select className="auth-input" value={career} onChange={(e) => setCareer(e.target.value)}>
                    <option value="">Carrera</option>
                    {careerOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select className="auth-input" value={cycle} onChange={(e) => setCycle(e.target.value)}>
                    <option value="">Ciclo</option>
                    {cycleOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <select className="auth-input" value={campus} onChange={(e) => setCampus(e.target.value)}>
                    <option value="">Sede</option>
                    {campusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-muted-foreground">Roles en el equipo</div>
                  <div className="grid grid-cols-2 gap-2">
                    {responsibilityOptions.map((item) => {
                      const selected = responsibilitySelections.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleResponsibility(item)}
                          aria-pressed={selected}
                          className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition ${
                            selected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  {responsibilitySelections.length > 0 && (
                    <div className="space-y-2">
                      {responsibilitySelections.map((role) => (
                        <div key={role} className="rounded-lg border border-border bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                          <div className="text-[11px] font-semibold text-slate-700">{role}</div>
                          <div>{responsibilityDetails[role] || ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="w-full border rounded-lg py-2 text-sm" onClick={handleJoin} disabled={loading}>
                    Solicitar acceso
                  </button>
                </div>
                )}
              </div>

              <div className="bg-card/70 border border-border rounded-xl p-3 space-y-2">
                <div className="text-sm font-semibold text-foreground">Resumen de líneas de investigación</div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {researchLines.map((line) => (
                    <div key={line.label} className="flex items-start justify-between gap-2">
                      <div className="text-foreground">{line.label}</div>
                      <div className="text-right">{line.ods.join(", ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="bg-card/70 border border-border rounded-xl p-3 space-y-2">
              <div className="text-sm font-semibold text-foreground">Qué significa cada ODS</div>
              <div className="space-y-2 text-xs text-muted-foreground">
                {odsGlossary.map((item) => (
                  <div key={item.key} className="flex items-start gap-2">
                    <div className="min-w-[52px] text-foreground">{item.key}</div>
                    <div>{item.label}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="mt-4 text-sm">
            <Link className="text-primary hover:underline" to="/">
              Volver a inicio de sesión
            </Link>
          </div>
        </div>
      }
    />
  );
}
