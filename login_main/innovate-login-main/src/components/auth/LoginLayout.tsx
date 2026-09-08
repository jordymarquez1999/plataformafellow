import { ReactNode } from 'react';
import AnimatedBackground from './AnimatedBackground';

interface LoginLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
}

const LoginLayout = ({ leftPanel, rightPanel }: LoginLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBackground />
      
      {/* Main card */}
      <div 
        className="glass-card w-full max-w-5xl rounded-2xl overflow-hidden opacity-0 animate-slide-up relative z-10"
        style={{ animationDelay: '100ms' }}
      >
        {/* Mobile branding (shown above form on small screens) */}
        <div className="lg:hidden border-b border-border/50 bg-gradient-to-br from-muted/50 to-transparent">
          {leftPanel}
        </div>
        
        <div className="grid lg:grid-cols-2">
          {/* Left panel - Branding (desktop only) */}
          <div className="hidden lg:flex bg-gradient-to-br from-muted/50 to-transparent border-r border-border/50">
            {leftPanel}
          </div>
          
          {/* Right panel - Form */}
          <div className="bg-card/80">
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginLayout;
