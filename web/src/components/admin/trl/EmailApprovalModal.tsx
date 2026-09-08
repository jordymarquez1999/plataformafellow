import React, { useMemo, useState } from "react";

interface EmailApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  projectName: string;
  initialEmail: string;
  approved: boolean;
  alreadySent: boolean;
  isSending: boolean;
}

const EmailApprovalModal: React.FC<EmailApprovalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  initialEmail,
  approved,
  alreadySent,
  isSending,
}) => {
  const [email, setEmail] = useState(initialEmail || "");
  const [isEditing, setIsEditing] = useState(!alreadySent);

  const title = useMemo(() => (approved ? "Enviar correo" : "Aprobar y enviar correo"), [approved]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{projectName}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSending}
              className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              X
            </button>
          </div>

          {alreadySent ? (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Este proyecto ya tiene un correo enviado. Esta acción volverá a mandarlo.
            </div>
          ) : null}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Correo de destino</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing || isSending}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="correo@ejemplo.com"
              />
              {alreadySent ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isSending}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Modificar
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(email.trim())}
              disabled={isSending}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-70"
            >
              {isSending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando...
                </span>
              ) : (
                "Enviar"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailApprovalModal;
