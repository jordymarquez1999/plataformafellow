import { useRef, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Loader2, CheckCircle, AlertCircle, LogIn } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { apiPost } from "../../lib/api";

type LoginFormProps = {
  onSuccess: (payload: { userId: string; projectId?: string; inviteCode?: string; approvalStatus?: string; role?: string; name?: string; avatarUrl?: string }) => void;
  onClearPending?: () => void;
  onNotRegistered?: () => void;
};

export default function LoginForm({ onSuccess, onClearPending, onNotRegistered }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showGoogleHint, setShowGoogleHint] = useState(false);
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleIntentRef = useRef<"login" | "new" | "join">("login");

  function getGoogleClientId() {
    return window.__APP_CONFIG__?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleBusy(true);
      setMessage("");
      try {
        const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenResponse.access_token}`);
        if (!userInfoRes.ok) throw new Error("google_userinfo_failed");
        const userInfo = await userInfoRes.json();
        const gEmail = userInfo?.email;
        const gName = userInfo?.name || userInfo?.given_name || "";
        const gPicture = userInfo?.picture || "";
        if (!gEmail) {
          setMessage("No se pudo leer el correo de Google.");
          return;
        }
        try {
          const data = await apiPost("/auth/login", { email: gEmail, password: "google-oauth", rememberMe: true });
          onSuccess({
            userId: data.userId,
            projectId: data.projectId,
            inviteCode: data.invite_code,
            approvalStatus: data.approval_status,
            role: data.role,
            name: data.name || gName,
            avatarUrl: gPicture || undefined,
          });
          return;
        } catch {
          // usuario no existe o no puede iniciar sesión, revisar intención
        }
        if (googleIntentRef.current === "login") {
          try {
            localStorage.removeItem("ff_pending_request");
          } catch {
            // ignore storage errors
          }
          onClearPending?.();
          onNotRegistered?.();
          setMessage("Tu cuenta no está registrada. Usa los otros botones para registrar un proyecto o unirte con código.");
          return;
        }
        try {
          localStorage.setItem("ff_pending", JSON.stringify({ name: gName, email: gEmail, picture: gPicture }));
        } catch {
          // ignore storage errors
        }
        const next = googleIntentRef.current === "new" ? "/onboarding?mode=new" : "/onboarding?mode=join";
        navigate(next);
      } catch {
        setMessage("Error procesando la respuesta de Google.");
      } finally {
        setGoogleBusy(false);
      }
    },
    onError: () => {
      setMessage("No se pudo cargar Google; revisa el client_id.");
    },
  });


  function validateEmail(v: string) {
    if (!v) return "El correo es requerido";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(v)) return "Correo inválido";
    return;
  }
  function validatePassword(v: string) {
    if (!v) return "La contraseña es requerida";
    if (v.length < 8) return "Mínimo 8 caracteres";
    return;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passError = validatePassword(password);
    if (emailError || passError) return setErrors({ email: emailError, password: passError });
    setLoading(true);
    setErrors({});
    setSuccessMessage("");
    setShowGoogleHint(false);
    try {
      const data = await apiPost("/auth/login", { email, password, rememberMe });
      onSuccess({
        userId: data.userId,
        projectId: data.projectId,
        inviteCode: data.invite_code,
        approvalStatus: data.approval_status,
        role: data.role,
        name: data.name,
      });
      setSuccessMessage("Inicio de sesión exitoso.");
    } catch (err: any) {
      setErrors({ general: err.message || "Error al iniciar sesión" });
      setShowGoogleHint(true);
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="p-8 lg:p-12">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary">
          <LogIn className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">Acceso seguro</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground mt-2">Iniciar sesión</h2>
        <p className="text-muted-foreground text-sm">Si ya te registraste, inicia sesión con Google usando tu correo institucional.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
            <CheckCircle className="w-4 h-4" />
            {successMessage}
          </div>
        )}
        {errors.general && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {errors.general}
          </div>
        )}
        {showGoogleHint && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <div className="font-semibold">Si ya estás registrado, inicia sesión con Google.</div>
              <div>Debes usar tu correo institucional de Google para acceder.</div>
            </div>
          </div>
        )}
        {message && !errors.general && !successMessage && <div className="text-sm text-slate-200">{message}</div>}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Correo electrónico</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input className={`auth-input pl-10 ${errors.email ? "error" : ""}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input className={`auth-input pl-10 pr-11 ${errors.password ? "error" : ""}`} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.password}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Recordarme
          </label>
          <span>¿Olvidaste tu contraseña?</span>
        </div>

        <button type="submit" disabled={loading} className="w-full gradient-button text-primary-foreground font-semibold py-3 px-4 rounded-lg">
          <span className="flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? "Iniciando..." : "Entrar"}
          </span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-card px-2 text-muted-foreground">o continuar con</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
          {[
            { label: "Iniciar sesión con Google", intent: "login" as const },
            { label: "Registrar proyecto nuevo con Google", intent: "new" as const },
            { label: "Unirme a un proyecto con Google", intent: "join" as const },
          ].map((option) => (
            <button
              key={option.intent}
              type="button"
              onClick={() => {
                const cid = getGoogleClientId();
                if (!cid) {
                  setMessage("No se pudo cargar Google; falta client_id.");
                  return;
                }
                if (!googleBusy) {
                  googleIntentRef.current = option.intent;
                  googleLogin();
                }
              }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${option.intent === "login" ? "bg-primary text-primary-foreground border-primary/60 shadow-lg shadow-primary/20" : "border-border bg-muted/50 text-foreground hover:bg-muted"}`}
              disabled={googleBusy || !getGoogleClientId()}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-sm font-medium">{googleBusy ? "Conectando..." : option.label}</span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

