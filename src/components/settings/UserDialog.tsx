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

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: SystemUser;
  onSave: (userData: any) => Promise<boolean>;
}

export function UserDialog({ open, onOpenChange, user, onSave }: UserDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    role: "broker",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        username: user.username || "",
        password: "",
        role: user.role,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        username: "",
        password: "",
        role: "", // Vem em branco para novo usuário
      });
    }
  }, [user, open]);

  // Force cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      // Use the centralized cleanup function with delay
      setTimeout(() => {
        forceDialogCleanup();
      }, 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success) {
        onOpenChange(false);
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
          // Additional cleanup on close
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
              : "Preencha os dados do novo usuário. Email e nome de usuário devem ser únicos."}
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
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  disabled={isSubmitting}
                  className="h-11"
                  placeholder="usuario@exemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  disabled={isSubmitting}
                  placeholder="(00) 00000-0000"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="usuario.login"
                  required
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Perfil <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
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
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">
                  Senha Temporária
                  {user && (
                    <span className="block text-muted-foreground text-xs mt-1">
                      (deixe em branco para manter a senha atual)
                    </span>
                  )}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={
                    user ? "Deixe em branco para não alterar" : "Senha de acesso"
                  }
                  required={!user}
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>
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
              disabled={isSubmitting}
              className="w-full sm:w-auto h-11"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                "Salvar Usuário"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}