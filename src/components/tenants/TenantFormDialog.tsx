import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tenant } from "@/types";
import { applyCpfMask, applyCnpjMask, applyPhoneMask, applyRgMask, applyCepMask, fetchAddressByCEP } from "@/lib/masks";
import { Pencil, Loader2 } from "lucide-react";

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Partial<Tenant> | null;
  onSave: (data: Partial<Tenant>) => Promise<boolean>;
  isViewMode?: boolean;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  document: string;
  cpf: string;
  cnpj: string;
  rg: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  status: "new" | "rented" | "inactive";
}

const INITIAL_FORM_STATE: FormState = {
  name: "",
  email: "",
  phone: "",
  document: "",
  cpf: "",
  cnpj: "",
  rg: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  status: "new",
};

const PersonalDataSection = memo(function PersonalDataSection({
  formData,
  documentType,
  setDocumentType,
  isEditing,
  onFieldChange,
  onPhoneChange,
  handleCpfChange,
  handleCnpjChange,
  handleRgChange,
  onStatusChange,
  showStatus,
}: {
  formData: FormState;
  documentType: "cpf" | "cnpj";
  setDocumentType: (type: "cpf" | "cnpj") => void;
  isEditing: boolean;
  onFieldChange: (field: keyof FormState, value: string) => void;
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCpfChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCnpjChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRgChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStatusChange: (value: string) => void;
  showStatus: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tenant-name" className="text-sm font-medium">
            {documentType === "cnpj" ? "Nome Fantasia *" : "Nome Completo *"}
          </Label>
          <Input
            id="tenant-name"
            value={formData.name}
            onChange={(e) => onFieldChange("name", e.target.value)}
            placeholder={documentType === "cnpj" ? "Nome Fantasia" : "Nome completo"}
            required
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-document" className="text-sm font-medium">CPF/CNPJ *</Label>
          <div className="flex gap-2 mb-2">
            <Button
              id="tenant-doc-type-cpf"
              type="button"
              variant={documentType === "cpf" ? "default" : "outline"}
              size="sm"
              onClick={() => setDocumentType("cpf")}
              disabled={!isEditing}
              className="flex-1"
            >
              CPF
            </Button>
            <Button
              id="tenant-doc-type-cnpj"
              type="button"
              variant={documentType === "cnpj" ? "default" : "outline"}
              size="sm"
              onClick={() => setDocumentType("cnpj")}
              disabled={!isEditing}
              className="flex-1"
            >
              CNPJ
            </Button>
          </div>
          <Input
            id="tenant-document"
            value={documentType === "cpf" ? formData.cpf : formData.cnpj}
            onChange={documentType === "cpf" ? handleCpfChange : handleCnpjChange}
            placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
            required
            disabled={!isEditing}
            maxLength={documentType === "cpf" ? 14 : 18}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-rg" className="text-sm font-medium" style={{ visibility: documentType === "cnpj" ? "hidden" : "visible" }}>
            RG
          </Label>
          <Input
            id="tenant-rg"
            value={formData.rg}
            onChange={handleRgChange}
            placeholder="00.000.000-0"
            disabled={!isEditing || documentType === "cnpj"}
            maxLength={12}
            className="h-11 sm:h-10 text-sm mobile-input"
            style={{ visibility: documentType === "cnpj" ? "hidden" : "visible" }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-phone" className="text-sm font-medium">Telefone *</Label>
          <Input
            id="tenant-phone"
            value={formData.phone}
            onChange={onPhoneChange}
            placeholder="(00) 00000-0000"
            required
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-email" className="text-sm font-medium">E-mail *</Label>
          <Input
            id="tenant-email"
            type="email"
            value={formData.email}
            onChange={(e) => onFieldChange("email", e.target.value)}
            placeholder="email@exemplo.com"
            required
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        {showStatus && (
          <div className="space-y-2">
            <Label htmlFor="tenant-status" className="text-sm font-medium">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => onStatusChange(value)}
              disabled={!isEditing}
            >
              <SelectTrigger id="tenant-status" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="rented">Locatário</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
});

const AddressSection = memo(function AddressSection({
  formData,
  isEditing,
  loadingCep,
  onFieldChange,
  onCepChange,
}: {
  formData: FormState;
  isEditing: boolean;
  loadingCep: boolean;
  onFieldChange: (field: keyof FormState, value: string) => void;
  onCepChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t">
      <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="tenant-cep" className="text-sm font-medium">CEP</Label>
          <div className="relative">
            <Input
              id="tenant-cep"
              value={formData.cep}
              onChange={onCepChange}
              placeholder="00000-000"
              disabled={!isEditing}
              className="h-11 sm:h-10 text-sm mobile-input"
            />
            {loadingCep && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="tenant-street" className="text-sm font-medium">Rua/Logradouro</Label>
          <Input
            id="tenant-street"
            value={formData.street}
            onChange={(e) => onFieldChange("street", e.target.value)}
            placeholder="Rua, avenida, etc."
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-number" className="text-sm font-medium">Número</Label>
          <Input
            id="tenant-number"
            value={formData.number}
            onChange={(e) => onFieldChange("number", e.target.value)}
            placeholder="123"
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-complement" className="text-sm font-medium">Complemento</Label>
          <Input
            id="tenant-complement"
            value={formData.complement}
            onChange={(e) => onFieldChange("complement", e.target.value)}
            placeholder="Apto, casa, etc."
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="tenant-neighborhood" className="text-sm font-medium">Bairro</Label>
          <Input
            id="tenant-neighborhood"
            value={formData.neighborhood}
            onChange={(e) => onFieldChange("neighborhood", e.target.value)}
            placeholder="Bairro"
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-city" className="text-sm font-medium">Cidade</Label>
          <Input
            id="tenant-city"
            value={formData.city}
            onChange={(e) => onFieldChange("city", e.target.value)}
            placeholder="Cidade"
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenant-state" className="text-sm font-medium">Estado</Label>
          <Input
            id="tenant-state"
            value={formData.state}
            onChange={(e) => onFieldChange("state", e.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            maxLength={2}
            disabled={!isEditing}
            className="h-11 sm:h-10 text-sm mobile-input uppercase"
          />
        </div>
      </div>
    </div>
  );
});

export const TenantFormDialog = memo(function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
  onSave,
  isViewMode = false,
}: TenantFormDialogProps) {
  const [isEditing, setIsEditing] = useState(!isViewMode);
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj">("cpf");
  const [loadingCep, setLoadingCep] = useState(false);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);

  useEffect(() => {
    if (!open) return;

    setIsEditing(!isViewMode);

    if (tenant) {
      const rawDocType = tenant.document_type || tenant.documentType;
      const docType: "cpf" | "cnpj" = (rawDocType === "cnpj") ? "cnpj" : "cpf";
      
      setFormData({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        document: tenant.document || "",
        cpf: tenant.cpf || (docType === "cpf" ? tenant.document : "") || "",
        cnpj: tenant.cnpj || (docType === "cnpj" ? tenant.document : "") || "",
        rg: tenant.rg || "",
        cep: tenant.cep || "",
        street: tenant.street || "",
        number: tenant.number || "",
        complement: tenant.complement || "",
        neighborhood: tenant.neighborhood || "",
        city: tenant.city || "",
        state: tenant.state || "",
        status: tenant.status || "new",
      });
      setDocumentType(docType);
    } else {
      setFormData(INITIAL_FORM_STATE);
      setDocumentType("cpf");
    }
  }, [open, tenant, isViewMode]);

  const handleFieldChange = useCallback((field: keyof FormState, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setFormData(prev => ({ ...prev, phone: masked }));
  }, []);

  const handleCpfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    
    // Limitar a 11 dígitos
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    
    // Formatar CPF: 000.000.000-00
    if (value.length >= 10) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
    } else if (value.length >= 7) {
      value = value.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
    } else if (value.length >= 4) {
      value = value.replace(/(\d{3})(\d{0,3})/, "$1.$2");
    }
    
    setFormData(prev => ({ ...prev, cpf: value, document: value }));
  }, []);

  const handleCnpjChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    
    // Limitar a 14 dígitos
    if (value.length > 14) {
      value = value.slice(0, 14);
    }
    
    // Formatar CNPJ: 00.000.000/0000-00
    if (value.length >= 13) {
      value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
    } else if (value.length >= 9) {
      value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    } else if (value.length >= 6) {
      value = value.replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    } else if (value.length >= 3) {
      value = value.replace(/(\d{2})(\d{0,3})/, "$1.$2");
    }
    
    setFormData(prev => ({ ...prev, cnpj: value, document: value }));
  }, []);

  const handleRgChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    
    // Limitar a 9 dígitos
    if (value.length > 9) {
      value = value.slice(0, 9);
    }
    
    // Formatar RG: 00.000.000-0
    if (value.length >= 9) {
      value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, "$1.$2.$3-$4");
    } else if (value.length >= 6) {
      value = value.replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    } else if (value.length >= 3) {
      value = value.replace(/(\d{2})(\d{0,3})/, "$1.$2");
    }
    
    setFormData(prev => ({ ...prev, rg: value }));
  }, []);

  const handleCepChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyCepMask(e.target.value);
    setFormData(prev => ({ ...prev, cep: masked }));

    const cleanCep = masked.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const address = await fetchAddressByCEP(cleanCep);
        if (address && !address.erro) {
          setFormData(prev => ({
            ...prev,
            street: address.logradouro || "",
            neighborhood: address.bairro || "",
            city: address.localidade || "",
            state: address.uf || "",
          }));
        }
      } catch (error) {
        // Silently fail
      } finally {
        setLoadingCep(false);
      }
    }
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, status: value as "new" | "rented" | "inactive" }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const newTenantData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      cpf: formData.cpf,
      cnpj: formData.cnpj,
      rg: formData.rg,
      document_type: documentType,
      cep: formData.cep,
      street: formData.street,
      number: formData.number,
      complement: formData.complement,
      neighborhood: formData.neighborhood,
      city: formData.city,
      state: formData.state,
      status: formData.status as "new" | "rented" | "inactive",
    };

    const success = await onSave(newTenantData);
    if (success) {
      onOpenChange(false);
    }
  }, [formData, documentType, onSave, onOpenChange]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2 pb-3">
          <DialogTitle className="text-base sm:text-lg font-bold">
            {tenant && isViewMode && !isEditing
              ? "Visualização do Inquilino"
              : tenant && isEditing
              ? "Editar Inquilino"
              : "Novo Inquilino"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {tenant ? "Atualize as informações do inquilino" : "Preencha com os dados pessoais do novo inquilino"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PersonalDataSection
            formData={formData}
            documentType={documentType}
            setDocumentType={setDocumentType}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
            onPhoneChange={handlePhoneChange}
            handleCpfChange={handleCpfChange}
            handleCnpjChange={handleCnpjChange}
            handleRgChange={handleRgChange}
            onStatusChange={handleStatusChange}
            showStatus={!!tenant}
          />

          <AddressSection
            formData={formData}
            isEditing={isEditing}
            loadingCep={loadingCep}
            onFieldChange={handleFieldChange}
            onCepChange={handleCepChange}
          />

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t">
            {isViewMode && !isEditing ? (
              <>
                <Button 
                  id="tenant-form-close"
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="h-11 sm:h-10 touch-target"
                >
                  Fechar
                </Button>
                <Button 
                  id="tenant-form-edit"
                  type="button" 
                  onClick={handleEdit}
                  className="h-11 sm:h-10 touch-target"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </>
            ) : (
              <>
                <Button 
                  id="tenant-form-cancel"
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="h-11 sm:h-10 touch-target"
                >
                  Cancelar
                </Button>
                <Button 
                  id="tenant-form-submit"
                  type="submit"
                  className="h-11 sm:h-10 touch-target"
                >
                  {tenant ? "Atualizar" : "Criar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});