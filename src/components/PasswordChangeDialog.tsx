import { useState, useEffect } from "react";
import { X, Check, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PasswordValidation {
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  minLength: boolean;
  maxLength: boolean;
  passwordsMatch: boolean;
}

interface PasswordChangeDialogProps {
  userId: string;
  onSuccess: () => void;
}

export function PasswordChangeDialog({ userId, onSuccess }: PasswordChangeDialogProps) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  const [validation, setValidation] = useState<PasswordValidation>({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    minLength: false,
    maxLength: true,
    passwordsMatch: false,
  });

  useEffect(() => {
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const minLength = newPassword.length >= 6;
    const maxLength = newPassword.length <= 12;
    // Validação em tempo real: fica verde assim que as senhas coincidirem
    const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0 && confirmPassword.length > 0;

    setValidation({
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      minLength,
      maxLength,
      passwordsMatch,
    });
  }, [newPassword, confirmPassword]);

  const isValid = 
    validation.hasUpperCase &&
    validation.hasLowerCase &&
    validation.hasNumber &&
    validation.minLength &&
    validation.maxLength &&
    validation.passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast({
        title: "Senha inválida",
        description: "Verifique os requisitos de senha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Atualizar senha no banco
      const { error } = await supabase
        .from("system_users")
        .update({
          password_hash: newPassword, // TEMPORARY: será hash depois
          requires_password_change: false,
          temporary_password: false,
        })
        .eq("id", userId);

      if (error) throw error;

      // Mostrar tela de sucesso
      setShowSuccessScreen(true);

      // Aguardar 3 segundos antes de redirecionar para login
      setTimeout(() => {
        onSuccess();
      }, 3000);

    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a senha.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const ValidationItem = ({ isValid, text }: { isValid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors ${isValid ? 'text-green-600' : 'text-red-600'}`}>
      {isValid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );

  // Tela de sucesso
  if (showSuccessScreen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-white">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full"></div>
          <div className="relative bg-gradient-to-br from-green-500 to-green-600 w-20 h-20 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-green-600 mb-3 text-center">
          Senha Alterada com Sucesso!
        </h2>
        
        <p className="text-slate-600 text-center mb-8 text-sm">
          Sua nova senha foi configurada.<br />
          Você será redirecionado para fazer login.
        </p>
        
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Redirecionando...</span>
        </div>
      </div>
    );
  }

  // Formulário de alteração de senha
  return (
    <div className="space-y-3">
      <div className="text-center pb-2 border-b">
        <h3 className="font-bold text-lg text-slate-900">Alterar Senha</h3>
        <p className="text-xs text-slate-600">Por segurança, você precisa criar uma nova senha</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-sm font-medium">Nova Senha</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              placeholder="Digite sua nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="h-9 text-sm pr-9"
              maxLength={12}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              disabled={loading}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Validações em tempo real */}
        <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 border">
          <p className="text-xs font-semibold text-slate-700 mb-1.5">Requisitos da senha:</p>
          <ValidationItem isValid={validation.hasUpperCase} text="Pelo menos 1 letra maiúscula" />
          <ValidationItem isValid={validation.hasLowerCase} text="Pelo menos 1 letra minúscula" />
          <ValidationItem isValid={validation.hasNumber} text="Pelo menos 1 número" />
          <ValidationItem isValid={validation.minLength} text="No mínimo 6 caracteres" />
          <ValidationItem isValid={validation.passwordsMatch} text="As senhas precisam ser idênticas" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Nova Senha</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Digite novamente sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-9 text-sm pr-9"
              maxLength={12}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              disabled={loading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-sm"
          disabled={loading || !isValid}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Senha"
          )}
        </Button>
      </form>

      <div className="text-center pt-2 border-t">
        <p className="text-xs text-slate-500">
          Após salvar, você fará login com a nova senha
        </p>
      </div>
    </div>
  );
}