import { useNavigate } from 'react-router-dom';
import { LogOut, Lightbulb, LayoutDashboard } from 'lucide-react';
import AnimatedBackground from '@/components/auth/AnimatedBackground';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-foreground">Plataforma de Innovación</h1>
                <p className="text-xs text-muted-foreground">Concurso de proyectos innovadores</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/50 text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          <div className="glass-card rounded-2xl p-8 lg:p-12 max-w-3xl mx-auto text-center opacity-0 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
              <LayoutDashboard className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              ¡Bienvenido al Dashboard!
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Has iniciado sesión correctamente. Este es un placeholder para el panel de control de la plataforma.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <div className="px-6 py-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-2xl font-bold gradient-text">0</p>
                <p className="text-sm text-muted-foreground">Proyectos activos</p>
              </div>
              <div className="px-6 py-4 rounded-xl bg-secondary/10 border border-secondary/20">
                <p className="text-2xl font-bold text-secondary">0</p>
                <p className="text-sm text-muted-foreground">Evaluaciones pendientes</p>
              </div>
              <div className="px-6 py-4 rounded-xl bg-success/10 border border-success/20">
                <p className="text-2xl font-bold text-success">0</p>
                <p className="text-sm text-muted-foreground">Proyectos completados</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
