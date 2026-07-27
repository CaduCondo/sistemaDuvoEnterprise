import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, Loader2, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

export default function RedefinirSenha() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);

  useEffect(() => {
    // Verificar se há um token válido
    const checkToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Link inválido ou expirado. Solicite um novo link de recuperação.");
        setValidatingToken(false);
        return;
      }

      setValidatingToken(false);
    };

    checkToken();
  }, []);

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return "A senha deve ter no mínimo 8 caracteres";
    }
    if (!/[A-Z]/.test(pass)) {
      return "A senha deve conter pelo menos uma letra maiúscula";
    }
    if (!/[a-z]/.test(pass)) {
      return "A senha deve conter pelo menos uma letra minúscula";
    }
    if (!/[0-9]/.test(pass)) {
      return "A senha deve conter pelo menos um número";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      // Atualizar senha via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        setError(updateError.message || "Erro ao atualizar senha. Tente novamente.");
        setLoading(false);
        return;
      }

      // Sucesso
      setSuccess(true);

      // Fazer logout após trocar senha
      await supabase.auth.signOut();

      // Redirecionar para home/login após 3 segundos
      setTimeout(() => {
        router.push("/");
      }, 3000);

    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      setError("Erro ao processar sua solicitação. Tente novamente.");
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <>
        <SEO title="Validando..." />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Validando link de recuperação...</p>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <SEO title="Senha Alterada com Sucesso!" />
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="mx-auto bg-gradient-to-br from-green-600 to-green-800 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl mb-6 animate-bounce">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-green-700 mb-4">
              Senha Alterada com Sucesso!
            </h1>
            
            <p className="text-slate-600 mb-6">
              Sua senha foi atualizada com sucesso.<br/>
              Você será redirecionado para fazer login...
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecionando em alguns instantes...
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Redefinir Senha" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-center">
              <div className="mx-auto bg-white w-16 h-16 rounded-xl flex items-center justify-center shadow-lg mb-4">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">D'Uvo Enterprise</h1>
              <p className="text-blue-100 text-sm">Property Control System</p>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Criar Nova Senha</h2>
                <p className="text-sm text-slate-600">
                  Defina uma senha forte e segura para sua conta
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua nova senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Digite novamente sua senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Requisitos da senha */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold text-sm text-slate-900 mb-2">Requisitos da senha:</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${password.length >= 8 ? 'bg-green-500' : 'bg-slate-300'}`} />
                      Mínimo de 8 caracteres
                    </li>
                    <li className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-slate-300'}`} />
                      Pelo menos uma letra maiúscula
                    </li>
                    <li className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-slate-300'}`} />
                      Pelo menos uma letra minúscula
                    </li>
                    <li className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-green-500' : 'bg-slate-300'}`} />
                      Pelo menos um número
                    </li>
                  </ul>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Nova Senha"
                  )}
                </Button>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 text-center">
              <p className="text-xs text-slate-500">
                Desenvolvido por <span className="font-semibold">Carlos Uva</span>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}