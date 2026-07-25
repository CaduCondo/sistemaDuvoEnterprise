import { useState } from "react";
import { Building2, LogIn, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";

export function PublicHeader() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      localStorage.removeItem("auth_session");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("rental_auth_user");
      localStorage.removeItem("currentUser");

      const result = await login({ email: username, password });
      
      if (result.success && result.user) {
        // Resetar tentativas em caso de sucesso
        setAttempts(0);
        toast({
          title: "Login realizado",
          description: "Redirecionando para o painel...",
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = "/dashboard";
        return;
      }

      // Incrementar tentativas
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      // Mensagens amigáveis baseadas no número de tentativas
      if (result.error?.includes("bloqueada")) {
        setError(result.error);
      } else {
        const remaining = 3 - newAttempts;
        if (remaining > 0) {
          setError(`Senha incorreta. Você tem mais ${remaining} tentativa${remaining > 1 ? 's' : ''}.`);
        } else {
          setError("Conta bloqueada temporariamente por muitas tentativas falhas. Tente novamente em 30 minutos.");
          setOpen(false);
          toast({
            title: "Conta bloqueada",
            description: "Muitas tentativas falhas. Aguarde 30 minutos para tentar novamente.",
            variant: "destructive",
          });
        }
      }
      
    } catch (error) {
      console.error("Erro durante login:", error);
      setError("Erro ao processar login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Recuperação de senha",
      description: "Entre em contato com o administrador do sistema para redefinir sua senha.",
    });
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">D'Uvo Enterprise Corporation</h1>
              <p className="text-xs text-slate-600">Seu novo lar está aqui</p>
            </div>
          </div>

          <DropdownMenu open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
              // Resetar ao fechar
              setError("");
              setPassword("");
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-slate-300 hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4" />
                Gerenciador
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4">
              <div className="space-y-3">
                <div className="text-center pb-2 border-b">
                  <div className="mx-auto bg-gradient-to-br from-blue-600 to-blue-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg mb-2">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">D'Uvo Enterprise</h3>
                  <p className="text-xs text-slate-600">Property Control System</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium">Usuário ou Email</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Digite seu usuário"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-9 text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded text-xs border border-red-200">
                      <AlertCircle size={14} />
                      <span>{error}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>

                <div className="text-center pt-2 border-t">
                  <p className="text-xs text-slate-500">
                    Desenvolvido por <span className="font-semibold">Carlos Uva</span>
                  </p>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}