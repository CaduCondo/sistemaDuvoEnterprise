import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, isAuthenticated } from "@/services/authService";

// Define simpler User type that matches authService
interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  photo?: string | null;
  phone?: string | null;
  cpf?: string | null;
  rg?: string | null;
  theme?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Lista de rotas públicas que não requerem autenticação
  const publicRoutes = ["/", "/login", "/redefinir-senha"];

  const refreshUser = () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser as User);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    // Check authentication on mount and route changes only
    const checkAuth = () => {
      try {
        const isPublicRoute = publicRoutes.includes(router.pathname);
        
        // Use authService as single source of truth
        if (isAuthenticated()) {
          const currentUser = getCurrentUser();
          if (currentUser) {
            setUser(currentUser as User);
          } else {
            setUser(null);
            if (!isPublicRoute) {
              router.push("/");
            }
          }
        } else {
          setUser(null);
          // Apenas redireciona para login se NÃO estiver em rota pública
          if (!isPublicRoute) {
            router.push("/");
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen to route changes instead of polling
    const handleRouteChange = () => {
      checkAuth();
    };

    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}