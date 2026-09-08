import LoginLayout from '@/components/auth/LoginLayout';
import BrandingPanel from '@/components/auth/BrandingPanel';
import LoginForm from '@/components/auth/LoginForm';

const Login = () => {
  return (
    <>
      <head>
        <title>Iniciar Sesión | Plataforma de Innovación</title>
        <meta name="description" content="Accede a la Plataforma de Innovación para el Concurso de Proyectos Innovadores. Donde las ideas se convierten en propuestas ganadoras." />
      </head>
      <main>
        <LoginLayout
          leftPanel={<BrandingPanel />}
          rightPanel={<LoginForm />}
        />
      </main>
    </>
  );
};

export default Login;
