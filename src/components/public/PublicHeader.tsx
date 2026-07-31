import { useState } from "react";
import { Building2, LogIn, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, Mail } from "lucide-react";
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
import { PasswordChangeDialog } from "@/components/PasswordChangeDialog";
import { supabase } from "@/integrations/supabase/client";

export function PublicHeader() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading || loginSuccess) return;
    
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      localStorage.removeItem("auth_session");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("rental_auth_user");
      localStorage.removeItem("currentUser");

      const result = await login({ email: username, password });
      
      if (result.success && result.user) {
        const { data: userData } = await supabase
          .from("system_users")
          .select("requires_password_change, id")
          .eq("id", result.user.id)
          .single();

        if (userData?.requires_password_change) {
          setUserId(userData.id);
          setRequiresPasswordChange(true);
          setLoading(false);
          return;
        }

        setAttempts(0);
        setLoginSuccess(true);
        setSuccessMessage("Login realizado com sucesso! Redirecionando...");
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.location.href = "/dashboard";
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
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
      if (!loginSuccess) {
        setLoading(false);
      }
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    
    try {
      // Verificar se o e-mail existe no sistema
      const { data: user, error: userError } = await supabase
        .from("system_users")
        .select("id, name, email")
        .eq("email", recoveryEmail)
        .eq("active", true)
        .single();

      if (userError || !user) {
        toast({
          title: "Erro",
          description: "E-mail não encontrado no sistema.",
          variant: "destructive",
        });
        setRecoveryLoading(false);
        return;
      }

      // Gerar senha temporária aleatória (8-12 caracteres com todos os requisitos)
      const generateTemporaryPassword = (): string => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const specials = '!@#$%&*';
        
        // Garantir pelo menos 1 de cada tipo
        let password = '';
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += specials[Math.floor(Math.random() * specials.length)];
        
        // Completar até 10 caracteres com caracteres aleatórios
        const allChars = uppercase + lowercase + numbers + specials;
        for (let i = 4; i < 10; i++) {
          password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Embaralhar a senha
        return password.split('').sort(() => Math.random() - 0.5).join('');
      };

      const temporaryPassword = generateTemporaryPassword();
      setGeneratedPassword(temporaryPassword);

      // Atualizar senha no banco
      const { error: updateError } = await supabase
        .from("system_users")
        .update({ 
          password_hash: temporaryPassword,
          requires_password_change: true,
          temporary_password: true,
          login_attempts: 0,
          blocked_until: null,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        toast({
          title: "Erro",
          description: "Não foi possível resetar a senha. Tente novamente.",
          variant: "destructive",
        });
        setRecoveryLoading(false);
        return;
      }

      // Enviar email com senha temporária
      const response = await fetch("/api/send-password-recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          userId: user.id,
          name: user.name,
          temporaryPassword: temporaryPassword,
          isReset: true,
          isAdminReset: false, // Flag: foi o próprio usuário que clicou "Esqueci minha senha"
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error("Erro ao enviar e-mail (senha já foi resetada):", result.error);
        // Mesmo que o email falhe, a senha já foi resetada - mostrar sucesso com a senha
        setRecoverySuccess(true);
        setRecoveryLoading(false);
        return;
      }

      // Sucesso completo
      setRecoverySuccess(true);
      setRecoveryLoading(false);
      
    } catch (error) {
      console.error("Erro ao recuperar senha:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar sua solicitação. Tente novamente.",
        variant: "destructive",
      });
      setRecoveryLoading(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    toast({
      title: "Senha atualizada!",
      description: "Redirecionando para o painel...",
    });
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
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
              setError("");
              setSuccessMessage("");
              setPassword("");
              setRequiresPasswordChange(false);
              setShowForgotPassword(false);
              setRecoveryEmail("");
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
              {requiresPasswordChange ? (
                <PasswordChangeDialog userId={userId} onSuccess={handlePasswordChangeSuccess} />
              ) : showForgotPassword ? (
                <div className="space-y-3">
                  {recoverySuccess ? (
                    // Tela de sucesso SEM mostrar a senha
                    <div className="text-center py-4">
                      <div className="mx-auto bg-gradient-to-br from-green-600 to-green-800 w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 animate-bounce">
                        <Mail className="h-8 w-8 text-white" />
                      </div>
                      
                      <h3 className="font-bold text-xl text-green-700 mb-2">E-mail Enviado com Sucesso!</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        Uma senha temporária foi enviada para:<br/>
                        <strong className="text-slate-900">{recoveryEmail}</strong>
                      </p>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-4">
                        <p className="font-semibold text-blue-900 mb-2 text-sm">📧 Verifique seu e-mail</p>
                        <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
                          <li>Enviamos uma <strong>senha temporária</strong> para seu e-mail</li>
                          <li>Use essa senha para fazer login</li>
                          <li>Você será obrigado a criar uma nova senha no primeiro login</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left mb-4">
                        <p className="font-semibold text-amber-900 mb-2 text-sm">⚠️ IMPORTANTE:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
                          <li>A nova senha deve ter <strong>8-12 caracteres</strong></li>
                          <li>Deve conter: <strong>maiúscula, minúscula, número e caractere especial</strong></li>
                        </ul>
                      </div>

                      <Button 
                        onClick={() => {
                          setShowForgotPassword(false);
                          setRecoverySuccess(false);
                          setRecoveryEmail("");
                          setGeneratedPassword("");
                          // Preencher username com o email de recuperação para facilitar
                          setUsername(recoveryEmail);
                        }}
                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-sm"
                      >
                        <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                        Voltar para Login
                      </Button>

                      <div className="text-center pt-3 border-t mt-4">
                        <p className="text-xs text-slate-500">
                          Desenvolvido por <span className="font-semibold">Carlos Uva</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Formulário de recuperação
                    <>
                      <div className="text-center pb-2 border-b">
                        <div className="mx-auto bg-gradient-to-br from-blue-600 to-blue-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg mb-2">
                          <Mail className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900">Recuperar Senha</h3>
                        <p className="text-xs text-slate-600">Digite seu e-mail para receber uma senha temporária</p>
                      </div>

                      <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="recovery-email" className="text-sm font-medium">E-mail</Label>
                          <Input
                            id="recovery-email"
                            type="email"
                            placeholder="seu@email.com"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            required
                            className="h-9 text-sm"
                          />
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                          <p className="font-semibold mb-1">🔐 Você receberá:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-xs">
                            <li>Senha temporária por e-mail</li>
                            <li>Acesso imediato ao sistema</li>
                            <li>Você será obrigado a criar uma nova senha no login</li>
                          </ul>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowForgotPassword(false);
                              setRecoveryEmail("");
                            }}
                            className="flex-1 h-9 text-sm"
                            disabled={recoveryLoading}
                          >
                            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                            Voltar
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-sm"
                            disabled={recoveryLoading}
                          >
                            {recoveryLoading ? (
                              <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              "Enviar Senha"
                            )}
                          </Button>
                        </div>
                      </form>

                      <div className="text-center pt-2 border-t">
                        <p className="text-xs text-slate-500">
                          Desenvolvido por <span className="font-semibold">Carlos Uva</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
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
                      <Label htmlFor="username" className="text-sm font-medium">E-mail:</Label>
                      <Input
                        id="username"
                        type="email"
                        placeholder="email@exemplo.com"
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
                    
                    {successMessage && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded text-xs border border-green-200">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">{successMessage}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          // Preencher email automaticamente se já digitado
                          if (username) {
                            setRecoveryEmail(username);
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-sm"
                      disabled={loading || loginSuccess}
                    >
                      {loading || loginSuccess ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          {loginSuccess ? "Redirecionando..." : "Entrando..."}
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
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}