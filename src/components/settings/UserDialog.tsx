import { useState, useEffect } from "react";
import { SystemUser } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { forceDialogCleanup } from "@/lib/forceCleanup";
import { useToast } from "@/hooks/use-toast";
import { createUser, updateUser } from "@/services/systemUserService";
import { supabase } from "@/integrations/supabase/client";
import { applyPhoneMask } from "@/lib/masks";
import { isEmailEnabled } from "@/services/emailSettingsService";

// Função para gerar senha temporária aleatória
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;
  
  let password = '';
  
  // Garantir pelo menos 1 maiúscula
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  
  // Garantir pelo menos 1 minúscula
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  
  // Garantir pelo menos 1 número
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Completar até 12 caracteres
  for (let i = 3; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Validação de email
function isValidEmail(email: string): boolean {
  return email.includes('@') && email.length > 3;
}

// Validação de telefone
function isValidPhone(phone: string): boolean {
  const numbers = phone.replace(/\D/g, '');
  return numbers.length === 10 || numbers.length === 11;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: SystemUser;
  onSave: (userData: any) => Promise<boolean>;
}

export function UserDialog({ open, onOpenChange, user, onSave }: UserDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "" as "" | "admin" | "broker" | "financial",
    active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        active: user.active !== undefined ? user.active : true,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "",
        active: true, // Ativado por padrão
      });
    }
    setEmailError("");
    setPhoneError("");
  }, [user, open]);

  // Force cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setTimeout(() => {
        forceDialogCleanup();
      }, 100);
    }
  }, [open]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setFormData({ ...formData, phone: masked });
    
    // Validar apenas se tiver conteúdo
    if (masked) {
      const numbers = masked.replace(/\D/g, '');
      if (numbers.length > 0 && !isValidPhone(masked)) {
        setPhoneError("Telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX");
      } else {
        setPhoneError("");
      }
    } else {
      setPhoneError("");
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setFormData({ ...formData, email });
    
    // Validar apenas se tiver conteúdo
    if (email && !isValidEmail(email)) {
      setEmailError("E-mail inválido. Deve conter @");
    } else {
      setEmailError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    // Validações finais
    if (!isValidEmail(formData.email)) {
      setEmailError("E-mail inválido. Deve conter @");
      return;
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      setPhoneError("Telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (user) {
        // Editar usuário existente - updateUser aceita: name, email, role, status
        await onSave({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.active ? "active" : "inactive",
        });
      } else {
        // Criar novo usuário - createUser aceita: name, email, role, password, temporary_password
        const temporaryPassword = generateTemporaryPassword();
        
        await onSave({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: temporaryPassword,
          temporary_password: true,
        });
      }

      // Chamar onSave para recarregar a lista
      await onSave({});
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar usuário:", error);
      
      if (error?.message?.includes("duplicate") || error?.code === "23505") {
        toast({
          title: "Erro",
          description: "O E-mail/Usuário já existe no sistema.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar o usuário.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          forceDialogCleanup();
        }}
        onEscapeKeyDown={(e) => {
          if (!isSubmitting) {
            handleOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Atualize as informações do usuário abaixo."
              : "Preencha os dados do novo usuário. O e-mail deve ser único e será usado para login."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleEmailChange}
                  required
                  disabled={isSubmitting}
                  className="h-11"
                  placeholder="usuario@exemplo.com"
                />
                {emailError && (
                  <p className="text-xs text-red-600">{emailError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Usado para login no sistema
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  disabled={isSubmitting}
                  placeholder="(00) 00000-0000"
                  className="h-11"
                  maxLength={15}
                />
                {phoneError && (
                  <p className="text-xs text-red-600">{phoneError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Perfil <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "admin" | "broker" | "financial") =>
                    setFormData({ ...formData, role: value })
                  }
                  disabled={isSubmitting}
                  required
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="broker">Corretor</SelectItem>
                    <SelectItem value="financial">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.active ? "active" : "inactive"}
                onValueChange={(value) =>
                  setFormData({ ...formData, active: value === "active" })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                      Ativado
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                      Desativado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)} 
              disabled={isSubmitting}
              className="w-full sm:w-auto h-11"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !!emailError || !!phoneError}
              className="w-full sm:w-auto h-11"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {user ? "Salvando..." : "Criando..."}
                </>
              ) : (
                user ? "Salvar Alterações" : "Criar Usuário"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}