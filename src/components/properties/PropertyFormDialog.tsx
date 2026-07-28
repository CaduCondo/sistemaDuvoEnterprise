import { useEffect, useState, useCallback, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Pencil, ImageIcon, Camera } from "lucide-react";
import { PropertyFormData } from "@/hooks/useProperties";
import { formatCurrencyInput, applyMoneyMask, formatMoneyForDisplay, parseMoneyMaskToNumber } from "@/lib/masks";

interface Location {
  id: string;
  name: string;
}

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: PropertyFormData;
  setFormData: (data: PropertyFormData) => void;
  isEditMode: boolean;
  locations: Location[];
  handleNumberChange: (field: "rooms" | "bathrooms", value: string) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  isSubmitting: boolean;
  viewOnly?: boolean;
  onEdit?: () => void;
}

const ImageGallery = memo(function ImageGallery({ 
  images, 
  onRemove, 
  isReadOnly 
}: { 
  images: string[]; 
  onRemove?: (index: number) => void;
  isReadOnly?: boolean;
}) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
      {images.map((image, index) => (
        <div key={index} className="relative aspect-video group">
          <img
            src={image}
            alt={`Foto ${index + 1}`}
            className="w-full h-full object-cover rounded-lg border"
          />
          {!isReadOnly && onRemove && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onRemove(index)}
              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
});

export const PropertyFormDialog = memo(function PropertyFormDialog({
  open,
  onOpenChange,
  onSubmit,
  formData,
  setFormData,
  isEditMode,
  locations,
  handleNumberChange,
  handleImageUpload,
  removeImage,
  isSubmitting,
  viewOnly = false,
  onEdit,
}: PropertyFormDialogProps) {
  const [isInternalEditMode, setIsInternalEditMode] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsInternalEditMode(false);
    }
  }, [open]);

  const isReadOnly = viewOnly && !isInternalEditMode;
  const showEditButton = viewOnly && !isInternalEditMode && isEditMode;

  const handleEditClick = useCallback(() => {
    setIsInternalEditMode(true);
    if (onEdit) {
      onEdit();
    }
  }, [onEdit]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
    setIsInternalEditMode(false);
  }, [onSubmit]);

  const handleFieldChange = useCallback((field: keyof PropertyFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  }, [formData, setFormData]);

  const handleMonthlyRentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyMoneyMask(e.target.value);
    handleFieldChange("monthly_rent", masked);
  }, [handleFieldChange]);

  const triggerFileInput = useCallback((inputId: string) => {
    document.getElementById(inputId)?.click();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2 pb-3">
          <DialogTitle className="text-base sm:text-lg font-bold">
            {isReadOnly ? "Visualizar Imóvel" : isEditMode ? "Editar Imóvel" : "Novo Imóvel"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isReadOnly
              ? "Visualize as informações do imóvel"
              : isEditMode
              ? "Atualize as informações do imóvel"
              : "Preencha as informações do novo imóvel"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="property-location" className="text-sm font-medium">
                Local *
              </Label>
              <Select
                value={formData.location_id}
                onValueChange={(value) => handleFieldChange("location_id", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger id="property-location" className="h-11 sm:h-10 text-sm mobile-input">
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-complement" className="text-sm font-medium">
                Complemento
              </Label>
              <Input
                id="property-complement"
                value={formData.complement}
                onChange={(e) => handleFieldChange("complement", e.target.value)}
                placeholder="Ex: Apto 102, Bloco A"
                className="h-11 sm:h-10 text-sm mobile-input"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="property-rooms" className="text-sm font-medium">
                Quartos *
              </Label>
              <Input
                id="property-rooms"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.rooms}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleFieldChange("rooms", value);
                }}
                placeholder="3"
                required
                className="h-11 sm:h-10 text-sm mobile-input"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-bathrooms" className="text-sm font-medium">
                Banheiros *
              </Label>
              <Input
                id="property-bathrooms"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.bathrooms}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleFieldChange("bathrooms", value);
                }}
                placeholder="2"
                required
                className="h-11 sm:h-10 text-sm mobile-input"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-area" className="text-sm font-medium">
                Área (m²) *
              </Label>
              <Input
                id="property-area"
                value={formData.area}
                onChange={(e) => handleFieldChange("area", e.target.value)}
                placeholder="80"
                className="h-11 sm:h-10 text-sm mobile-input"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property-value" className="text-sm font-medium">
                Valor
              </Label>
              <Input
                id="property-value"
                value={formData.monthly_rent}
                onChange={handleMonthlyRentChange}
                placeholder="R$ 0,00"
                className="h-11 sm:h-10 text-base font-semibold text-green-600 mobile-input"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 items-center">
            <div className="space-y-2">
              <Label htmlFor="property-status" className="text-sm font-medium">
                Status *
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleFieldChange("status", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger id="property-status" className="h-11 sm:h-10 text-sm mobile-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="occupied">Ocupado</SelectItem>
                  <SelectItem value="unavailable">Indisponível</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 h-[68px] sm:h-[60px]">
              <Checkbox
                id="property-furniture"
                checked={formData.hasFurniture}
                onCheckedChange={(checked) => handleFieldChange("hasFurniture", checked)}
                disabled={isReadOnly}
                className="h-5 w-5"
              />
              <Label htmlFor="property-furniture" className="text-sm cursor-pointer font-normal whitespace-nowrap">
                Móveis Planejados
              </Label>
            </div>

            <div className="flex items-center space-x-2 h-[68px] sm:h-[60px]">
              <Checkbox
                id="property-pets"
                checked={formData.acceptsPets}
                onCheckedChange={(checked) => handleFieldChange("acceptsPets", checked)}
                disabled={isReadOnly}
                className="h-5 w-5"
              />
              <Label htmlFor="property-pets" className="text-sm cursor-pointer font-normal whitespace-nowrap">
                Aceita Pets
              </Label>
            </div>

            <div className="flex items-center space-x-2 h-[68px] sm:h-[60px]">
              <Checkbox
                id="property-garage"
                checked={formData.hasGarage}
                onCheckedChange={(checked) => handleFieldChange("hasGarage", checked)}
                disabled={isReadOnly}
                className="h-5 w-5"
              />
              <Label htmlFor="property-garage" className="text-sm cursor-pointer font-normal whitespace-nowrap">
                Vaga Garagem
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property-description" className="text-sm font-medium">
              Descrição
            </Label>
            <Textarea
              id="property-description"
              value={formData.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              className="text-sm resize-none min-h-[80px] mobile-input"
              placeholder="Descreva o imóvel..."
              rows={3}
              disabled={isReadOnly}
            />
          </div>

          {!isReadOnly && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Fotos do Imóvel</Label>
              
              <ImageGallery 
                images={formData.images} 
                onRemove={removeImage}
                isReadOnly={false}
              />
              
              <div className="w-full">
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => triggerFileInput("photo-upload")}
                >
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Escolher Arquivo
                </Button>
              </div>
            </div>
          )}

          {isReadOnly && formData.images.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Fotos do Imóvel</Label>
              <ImageGallery 
                images={formData.images}
                isReadOnly={true}
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t">
            {showEditButton && (
              <Button 
                id="property-form-edit"
                type="button" 
                onClick={handleEditClick} 
                variant="default" 
                className="h-11 sm:h-10 touch-target"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar Imóvel
              </Button>
            )}
            {!isReadOnly && (
              <>
                <Button
                  id="property-form-cancel"
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="h-11 sm:h-10 touch-target"
                >
                  Cancelar
                </Button>
                <Button 
                  id="property-form-submit"
                  type="submit" 
                  disabled={isSubmitting} 
                  className="h-11 sm:h-10 touch-target"
                >
                  {isSubmitting ? "Salvando..." : isEditMode ? "Atualizar" : "Criar"}
                </Button>
              </>
            )}
            {isReadOnly && (
              <Button
                id="property-form-close"
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 sm:h-10 touch-target"
              >
                Fechar
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});