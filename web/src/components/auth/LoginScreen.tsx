import { useEffect, useState } from "react";
import BrandingPanel from "./BrandingPanel";
import LoginLayout from "./LoginLayout";
import LoginForm from "./LoginForm";

type Props = {
  onLoginSuccess: (payload: { userId: string; projectId?: string; inviteCode?: string; approvalStatus?: string; role?: string; name?: string; avatarUrl?: string }) => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [showPending, setShowPending] = useState(false);
  const [showNotRegistered, setShowNotRegistered] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("ff_pending_request")) {
        setShowPending(true);
      }
    } catch {
      // ignore
    }
  }, []);

  function handleSuccess(payload: { userId: string; projectId?: string; inviteCode?: string; approvalStatus?: string; role?: string; name?: string; avatarUrl?: string }) {
    const isApproved = payload.role === "admin" || payload.approvalStatus === "approved";
    try {
      if (isApproved) {
        localStorage.removeItem("ff_pending_request");
      } else {
        localStorage.setItem("ff_pending_request", "1");
        setShowPending(true);
      }
    } catch {
      // ignore
    }
    onLoginSuccess(payload);
  }

  return (
    <LoginLayout
      leftPanel={<BrandingPanel />}
      rightPanel={
        <div className="relative">
          <LoginForm
            onSuccess={handleSuccess}
            onClearPending={() => setShowPending(false)}
            onNotRegistered={() => {
              setShowPending(false);
              setShowNotRegistered(true);
            }}
          />
          {showPending && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
                <h3 className="text-lg font-semibold mb-2">Solicitud enviada</h3>
                <p className="text-sm text-slate-600">
                  Tu solicitud ha sido enviada. Espera la aprobación del administrador para ingresar.
                </p>
                <div className="mt-4 flex justify-end">
                  <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowPending(false)}>
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          )}
          {showNotRegistered && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
                <h3 className="text-lg font-semibold mb-2">Cuenta no registrada</h3>
                <p className="text-sm text-slate-600">
                  Tu cuenta no está registrada. Usa los otros botones para registrar un proyecto o unirte con código.
                </p>
                <div className="mt-4 flex justify-end">
                  <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowNotRegistered(false)}>
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
