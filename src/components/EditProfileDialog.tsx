import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SystemUser } from "@/types";
import { updateUser } from "@/services/systemUserService";
import { User, Mail, Phone, Shield, Save, Camera } from "lucide-react";
import { applyCpfMask, applyPhoneMask, removeMask } from "@/lib/masks";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SystemUser | null;
  onSuccess: () => void;
}

export function EditProfileDialog({ open, onOpenChange, user, onSuccess }: EditProfileDialogProps) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      console.log("🔍 ===== DEBUG EDIT PROFILE DIALOG =====");
      console.log("📋 User object recebido:", user);
      console.log("📞 Phone:", user.phone);
      console.log("🆔 CPF:", user.cpf);
      console.log("🆔 RG:", user.rg);
      console.log("🔍 ====================================");
      
      setSelectedUser(user);
      setPhotoPreview(user.photo || null);
    }
  }, [open, user]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhotoPreview(base64String);
      if (selectedUser) {
        setSelectedUser({ ...selectedUser, photo: base64String });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !user?.id) return;

    setIsSubmitting(true);

    try {
      const updates: Partial<SystemUser> = {
        name: selectedUser.name,
        email: selectedUser.email,
        phone: selectedUser.phone,
        role: selectedUser.role,
        cpf: selectedUser.cpf,
        rg: selectedUser.rg,
        photo: selectedUser.photo,
      };

      await updateUser(user.id, updates);
      
      // Atualiza a sessão local imediatamente para refletir na UI sem precisar deslogar
      try {
        const sessionStr = localStorage.getItem("auth_session");
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          session.user = { ...session.user, ...updates };
          localStorage.setItem("auth_session", JSON.stringify(session));
          localStorage.setItem("auth_user", JSON.stringify(session.user));
        }
      } catch (e) {
        console.error("Erro ao atualizar sessão local:", e);
      }
      
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
      
      // Chama onSuccess primeiro para atualizar o contexto
      onSuccess();
      
      // Aguarda um pequeno delay para garantir que o contexto foi atualizado
      setTimeout(() => {
        setIsSubmitting(false);
        onOpenChange(false);
      }, 100);
      
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      setIsSubmitting(false);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (!selectedUser) return;
    setSelectedUser(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleRoleChange = (value: string) => {
    if (!selectedUser) return;
    const roleValue = value as "admin" | "broker" | "financial";
    setSelectedUser(prev => prev ? { ...prev, role: roleValue } : null);
  };

  if (!selectedUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <User className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">Editar Perfil do Usuário</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center space-y-4 pb-4 border-b">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
              <AvatarImage src={photoPreview || undefined} alt={selectedUser.name} />
              <AvatarFallback className="text-xl sm:text-2xl">
                {selectedUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("photoUpload")?.click()}
              className="h-10 sm:h-9"
            >
              <Camera className="h-4 w-4 mr-2" />
              Alterar Foto
            </Button>
            <input
              id="photoUpload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informações Pessoais
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-name" className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span>Nome Completo</span>
                </Label>
                <Input
                  id="profile-name"
                  value={selectedUser.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-11"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-email" className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span>E-mail</span>
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={selectedUser.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="seu@email.com"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>Telefone</span>
                </Label>
                <Input
                  id="profile-phone"
                  value={selectedUser.phone ? applyPhoneMask(selectedUser.phone) : ""}
                  onChange={(e) => handleInputChange("phone", removeMask(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span>CPF</span>
                </Label>
                <Input
                  id="cpf"
                  value={selectedUser.cpf ? applyCpfMask(selectedUser.cpf) : ""}
                  onChange={(e) => handleInputChange("cpf", removeMask(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rg" className="text-sm">RG</Label>
                <Input
                  id="rg"
                  value={selectedUser.rg || ""}
                  onChange={(e) => handleInputChange("rg", e.target.value)}
                  placeholder="00.000.000-0"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm">Perfil</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={handleRoleChange}
                  disabled={user?.role !== "admin"}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="broker">Corretor</SelectItem>
                    <SelectItem value="financial">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}