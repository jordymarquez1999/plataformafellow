import { ReactNode } from "react";
import AnimatedBackground from "./AnimatedBackground";

export default function LoginLayout({ leftPanel, rightPanel }: { leftPanel: ReactNode; rightPanel: ReactNode }) {
  return (
    <div className="login-theme min-h-screen flex items-center justify-center p-4 relative text-foreground">
      <AnimatedBackground />
      <a
        href="/scimanage-papers/"
        className="absolute top-4 right-4 z-20 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/80 shadow-lg backdrop-blur hover:text-foreground"
      >
        Accede a Scimanage papers
      </a>
      <div className="glass-card w-full max-w-[1600px] rounded-2xl overflow-hidden opacity-0 animate-slide-up relative z-10" style={{ animationDelay: "100ms" }}>
        <div className="lg:hidden border-b border-border/50 bg-gradient-to-br from-muted/50 to-transparent">{leftPanel}</div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="hidden lg:flex bg-gradient-to-br from-muted/50 to-transparent border-r border-border/50">{leftPanel}</div>
          <div className="bg-card/80">{rightPanel}</div>
        </div>
      </div>
    </div>
  );
}
