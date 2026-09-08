import React, { useState } from "react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import ProjectDetailModal from "./ProjectDetailModal";
import EmailApprovalModal from "./EmailApprovalModal";
import { eliminarProyectoTrl, enviarCorreoTrl, forzarAprobacion, migrarProyectoTrl } from "../../../lib/trlApi";

interface ProjectData {
  EntryId?: string;
  "Nombre del Proyecto": string;
  Aprobado: "Si" | "No";
  "Nivel TRL"?: number;
  "Puntaje TRL 1-3": number;
  "Puntaje TRL 4-7": number;
  "Puntaje TRL 8-9": number;
  "Puntaje Total": number;
  "Segmento TRL"?: string;
  "Docente Acompanante"?: boolean;
  "Nivel de Ingles"?: string;
  Industria?: string;
  Ubicacion?: string;
  Correo?: string;
  CorreoEnviado?: boolean;
  CorreoEnvios?: number;
  CorreoUltimoEnvio?: string | null;
  CorreoUltimoEmail?: string;
  Insights?: string[] | string;
  AprobadoForzado?: boolean;
  [key: string]: any;
}

type EmailStatus = {
  email: string;
  sentAt: string;
  sends: number;
};

interface ProjectsTableProps {
  proyectos: ProjectData[];
  currentPage: number;
  itemsPerPage: number;
  setCurrentPage: (page: number) => void;
  hidePagination?: boolean;
  year: number;
  onRefresh?: () => Promise<void> | void;
}

const ProjectsTable: React.FC<ProjectsTableProps> = ({ proyectos, currentPage, itemsPerPage, setCurrentPage, hidePagination, year, onRefresh }) => {
  const getProjectName = (project: ProjectData) => String(project["Nombre del Proyecto"] || "").trim();
  const getProjectEmail = (project: ProjectData) => String(project.Correo || project["Correo"] || "").trim();
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" }>({
    key: "Puntaje Total",
    direction: "descending",
  });

  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionState, setActionState] = useState<{ name: string; type: "force" | "delete" | "migrate" } | null>(null);
  const [emailContext, setEmailContext] = useState<{ project: ProjectData; mode: "send" | "approve_send" } | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleViewDetails = (project: ProjectData) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const openEmailModal = (project: ProjectData, mode: "send" | "approve_send") => {
    setEmailContext({ project, mode });
    setIsEmailModalOpen(true);
  };

  const getEmailStatus = (project: ProjectData): EmailStatus | undefined => {
    const sends = Number(project.CorreoEnvios || 0);
    const sentFlag = Boolean(project.CorreoEnviado || sends > 0);
    if (!sentFlag) return undefined;
    const email = String(project.CorreoUltimoEmail || getProjectEmail(project)).trim();
    const sentAt = String(project.CorreoUltimoEnvio || "").trim();
    return {
      email,
      sentAt,
      sends: sends > 0 ? sends : 1,
    };
  };

  const handleSendEmail = async (email: string) => {
    if (!emailContext) return;
    if (isSendingEmail) return;
    const { project, mode } = emailContext;
    const nombre = getProjectName(project);
    if (!nombre) {
      alert("El proyecto no tiene nombre.");
      return;
    }
    if (!email || !isValidEmail(email)) {
      alert("Ingresa un correo válido.");
      return;
    }
    if (getEmailStatus(project) && !confirm("¿Estás seguro de querer volver a mandar el correo?")) {
      return;
    }

    setIsSendingEmail(true);
    if (mode === "approve_send") {
      try {
        await forzarAprobacion(nombre, year, true);
      } catch (error) {
        console.error("Error al aprobar:", error);
        alert("No se pudo aprobar el proyecto.");
        setIsSendingEmail(false);
        return;
      }
    }

    try {
      await enviarCorreoTrl(email, nombre, year);
      if (onRefresh) await onRefresh();
      setIsEmailModalOpen(false);
    } catch (error) {
      console.error("Error al enviar correo:", error);
      alert("No se pudo enviar el correo.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleForceApproval = async (project: ProjectData) => {
    const nombreRaw = String(project["Nombre del Proyecto"] || "");
    const nombre = nombreRaw.trim();
    if (!nombre) return;
    const nextForce = !project.AprobadoForzado;
    setActionState({ name: nombreRaw, type: "force" });
    try {
      await forzarAprobacion(nombre, year, nextForce);
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Error al forzar aprobación:", error);
      alert("No se pudo actualizar la aprobación.");
    } finally {
      setActionState(null);
    }
  };

  const handleDeleteProject = async (project: ProjectData) => {
    const nombreRaw = String(project["Nombre del Proyecto"] || "");
    const nombre = nombreRaw.trim();
    if (!nombre) return;
    if (!confirm(`¿Eliminar el proyecto "${nombre}"? Esta acción lo oculta del panel TRL.`)) return;
    setActionState({ name: nombreRaw, type: "delete" });
    try {
      await eliminarProyectoTrl(nombre, year);
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Error al eliminar proyecto:", error);
      alert("No se pudo eliminar el proyecto.");
    } finally {
      setActionState(null);
    }
  };

  const handleMigrateProject = async (project: ProjectData) => {
    const nombreRaw = String(project["Nombre del Proyecto"] || "");
    const nombre = nombreRaw.trim();
    const entryId = String(project.EntryId || project.id || "").trim();
    if (!nombre) return;
    if (year !== 2025) return;
    if (!confirm(`Migrar el proyecto "${nombre}" de 2025 a 2026?`)) return;
    setActionState({ name: nombreRaw, type: "migrate" });
    try {
      await migrarProyectoTrl(nombre, 2025, 2026, entryId || undefined);
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Error al migrar proyecto:", error);
      alert("No se pudo migrar el proyecto a 2026.");
    } finally {
      setActionState(null);
    }
  };

  const sortedProjects = [...proyectos].sort((a, b) => {
    if (a.Aprobado !== b.Aprobado) return a.Aprobado === "Si" ? -1 : 1;
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "ascending" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "ascending" ? 1 : -1;
    return 0;
  });

  const paginatedProjects = sortedProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const requestSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === "ascending" ? "descending" : "ascending";
    setSortConfig({ key, direction });
  };

  return (
    <div className="overflow-x-auto bg-white shadow-lg rounded-xl border border-gray-200">
      <table className="min-w-full text-lg text-left text-gray-800">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-4 font-semibold">Proyecto</th>
            <th className="px-6 py-4 font-semibold">Aprobado</th>
            {["Puntaje TRL 1-3", "Puntaje TRL 4-7", "Puntaje TRL 8-9", "Puntaje Total"].map((key) => (
              <th
                key={key}
                className="px-6 py-4 font-semibold cursor-pointer select-none hover:text-purple-600 transition-colors"
                onClick={() => requestSort(key)}
              >
                {key}
                {sortConfig.key === key &&
                  (sortConfig.direction === "ascending" ? (
                    <ChevronUpIcon className="inline w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDownIcon className="inline w-4 h-4 ml-1" />
                  ))}
              </th>
            ))}
            <th className="px-6 py-4 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="text-base">
          {paginatedProjects.map((proyecto, idx) => (
            <tr key={idx} className="hover:bg-purple-50 transition-all duration-200 border-t">
              <td className="px-6 py-4 font-medium">{proyecto["Nombre del Proyecto"]}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${proyecto.Aprobado === "Si" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {proyecto.Aprobado}
                  </span>
                  {proyecto.AprobadoForzado && <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Forzado</span>}
                </div>
              </td>
              {["Puntaje TRL 1-3", "Puntaje TRL 4-7", "Puntaje TRL 8-9", "Puntaje Total"].map((key) => (
                <td key={key} className="px-6 py-4">
                  {proyecto[key]}
                </td>
              ))}
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleViewDetails(proyecto)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition">
                    Ver detalles
                  </button>
                  {proyecto.Aprobado === "Si" || proyecto.AprobadoForzado ? (
                    <button
                      onClick={() => openEmailModal(proyecto, "send")}
                      className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition"
                    >
                      Enviar correo
                    </button>
                  ) : (
                    <button
                      onClick={() => openEmailModal(proyecto, "approve_send")}
                      className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition"
                    >
                      Aprobar y enviar correo
                    </button>
                  )}
                  {proyecto.AprobadoForzado && (
                    <button
                      onClick={() => handleForceApproval(proyecto)}
                      disabled={actionState?.name === proyecto["Nombre del Proyecto"] && actionState?.type === "force"}
                      className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 disabled:opacity-60 transition"
                    >
                      Quitar forzado
                    </button>
                  )}
                  {year === 2025 && (
                    <button
                      onClick={() => handleMigrateProject(proyecto)}
                      disabled={actionState?.name === proyecto["Nombre del Proyecto"] && actionState?.type === "migrate"}
                      className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-60 transition"
                    >
                      Migrar a 2026
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteProject(proyecto)}
                    disabled={actionState?.name === proyecto["Nombre del Proyecto"] && actionState?.type === "delete"}
                    className="px-3 py-1 text-sm bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 disabled:opacity-60 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!hidePagination && (
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t gap-4">
          <span className="text-base text-gray-700">
            Página <strong>{currentPage}</strong> de <strong>{Math.ceil(proyectos.length / itemsPerPage)}</strong>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(proyectos.length / itemsPerPage)}
              className="px-4 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {isModalOpen && selectedProject && <ProjectDetailModal project={selectedProject} onClose={() => setIsModalOpen(false)} year={year} />}

      {isEmailModalOpen && emailContext && (
        <EmailApprovalModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          onConfirm={handleSendEmail}
          projectName={getProjectName(emailContext.project)}
          initialEmail={getEmailStatus(emailContext.project)?.email || getProjectEmail(emailContext.project)}
          approved={emailContext.project.Aprobado === "Si" || Boolean(emailContext.project.AprobadoForzado)}
          alreadySent={Boolean(getEmailStatus(emailContext.project))}
          isSending={isSendingEmail}
        />
      )}
    </div>
  );
};

export default ProjectsTable;
