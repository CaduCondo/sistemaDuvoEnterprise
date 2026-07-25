import { useState, useEffect } from "react";
import { X, Check, Eye, EyeOff, Loader2 } from "lucide-react";
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
  const [touchedConfirm, setTouchedConfirm] = useState(false);

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
    const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

    setValidation({
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      minLength,
      maxLength,
      passwordsMatch: touchedConfirm ? passwordsMatch : false,
    });
  }, [newPassword, confirmPassword, touchedConfirm]);

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

      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi alterada com sucesso.",
      });

      // Pequeno delay para mostrar a mensagem
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ isValid, text }: { isValid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors ${isValid ? 'text-green-600' : 'text-red-600'}`}>
      {isValid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );

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
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
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
          <ValidationItem isValid={validation.maxLength} text="No máximo 12 caracteres" />
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
              onBlur={() => setTouchedConfirm(true)}
              required
              className="h-9 text-sm pr-9"
              maxLength={12}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {touchedConfirm && (
          <div className="bg-slate-50 p-2 rounded-lg border">
            <ValidationItem isValid={validation.passwordsMatch} text="As senhas precisam ser idênticas" />
          </div>
        )}

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
          Após salvar, você será redirecionado para o painel
        </p>
      </div>
    </div>
  );
}