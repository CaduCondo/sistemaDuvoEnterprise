import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MapPin,
  Bed,
  Bath,
  Car,
  Maximize2,
  Home,
  PawPrint,
  Armchair,
  Maximize,
  MessageCircle,
  Image as ImageIcon,
  Flame,
} from "lucide-react";
import { InterestFormDialog } from "./InterestFormDialog";
import { ShareButtons } from "./ShareButtons";
import { Lightbox } from "@/components/Lightbox";
import { Property } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { formatPublicCode } from "@/lib/propertyCode";
import type React from "react";

interface PropertyPublicCardProps {
  property: Property;
  priority?: boolean;
  index?: number;
}

export function PropertyPublicCard({ property, priority = false, index = 0 }: PropertyPublicCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [firstImage, setFirstImage] = useState<string | null>(null);
  const [allImages, setAllImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // 🔥 Carregar primeira imagem quando o card for montado
  useEffect(() => {
    async function loadFirstImage() {
      if (firstImage || loadingImages) return;
      
      setLoadingImages(true);
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("images")
          .eq("id", property.id)
          .single();

        if (error) throw error;
        
        const images = data?.images;
        if (images && Array.isArray(images) && images.length > 0) {
          const firstImg = images[0];
          if (firstImg && typeof firstImg === 'string') {
            setFirstImage(firstImg);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar primeira imagem:", err);
      } finally {
        setLoadingImages(false);
      }
    }

    loadFirstImage();
  }, [property.id, firstImage, loadingImages]);

  // 🔥 Carregar todas as imagens quando abrir o dialog de detalhes
  useEffect(() => {
    async function loadAllImages() {
      if (!showDetails || allImages.length > 0 || loadingImages) return;
      
      setLoadingImages(true);
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("images")
          .eq("id", property.id)
          .single();

        if (error) throw error;
        
        const images = data?.images;
        if (images && Array.isArray(images)) {
          // Filtrar e validar que todos são strings
          const validImages: string[] = [];
          for (const img of images) {
            if (img && typeof img === 'string' && img.length > 0) {
              validImages.push(img);
            }
          }
          setAllImages(validImages);
        }
      } catch (err) {
        console.error("Erro ao carregar imagens:", err);
      } finally {
        setLoadingImages(false);
      }
    }

    loadAllImages();
  }, [showDetails, property.id, allImages.length, loadingImages]);

  const images = allImages.length > 0 ? allImages : (property.allImages || property.images || []);
  const totalMonthly = property.value;

  const handleImageClick = () => {
    setShowDetails(true);
  };

  const handleThumbnailClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const handleCloseLightbox = () => {
    setShowLightbox(false);
  };

  const lightboxFiles = images.map((url, index) => ({
    name: `Foto ${index + 1}`,
    url: url,
    type: "image/jpeg",
  }));

  const displayTitle = property.location || property.propertyIdentifier || "Localização não informada";
  
  // Formatar apenas cidade e bairro para o card (não o endereço completo)
  const locationParts = [];
  if (property.neighborhood) locationParts.push(property.neighborhood);
  if (property.city) locationParts.push(property.city);
  const locationDisplay = locationParts.join(", ") || displayTitle;
  
  // Endereço completo só para o dialog de detalhes
  const addressParts = [];
  if (property.address) addressParts.push(property.address);
  if (property.complement && property.complement.trim() !== "") addressParts.push(property.complement);
  if (property.neighborhood) addressParts.push(property.neighborhood);
  if (property.city) addressParts.push(property.city);
  if (property.state) addressParts.push(property.state);
  
  const fullAddress = addressParts.join(", ");

  return (
    <>
      <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-xl">
        <div className="relative aspect-video overflow-hidden bg-slate-100" onClick={handleImageClick}>
          {firstImage ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-200 animate-pulse" />
              )}
              <img
                src={firstImage}
                alt={displayTitle}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading={index < 8 ? "eager" : "lazy"}
                fetchPriority={index < 4 ? "high" : "low"}
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                style={{ 
                  contentVisibility: 'auto',
                }}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-100">
              {loadingImages ? (
                <div className="animate-pulse">
                  <Home className="h-16 w-16 text-slate-300" />
                </div>
              ) : (
                <Home className="h-16 w-16 text-slate-300" />
              )}
            </div>
          )}
        </div>

        <CardContent className="space-y-4 p-6">
          <div>
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900">{displayTitle}</h3>
                
                {/* Mostrar apenas cidade e bairro no card */}
                {locationDisplay && locationDisplay !== displayTitle && (
                  <p className="text-sm text-slate-600 mt-1">
                    {locationDisplay}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 py-3 mt-3 border-t">
              {property.rooms > 0 && (
                <div className="flex items-center gap-1">
                  <Bed className="h-4 w-4" />
                  <span className="font-medium">{property.rooms} {property.rooms === 1 ? "quarto" : "quartos"}</span>
                </div>
              )}
              {property.bathrooms > 0 && (
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  <span className="font-medium">{property.bathrooms} {property.bathrooms === 1 ? "banheiro" : "banheiros"}</span>
                </div>
              )}
              {property.area > 0 && (
                <div className="flex items-center gap-1">
                  <Maximize2 className="h-4 w-4" />
                  <span className="font-medium">{property.area}m²</span>
                </div>
              )}
              {property.hasGarage && (
                <div className="flex items-center gap-1">
                  <Car className="h-4 w-4" />
                  <span className="font-medium">Garagem</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t">
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalMonthly.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {property.listingType !== "sale" && (
                  <span className="text-sm font-normal text-slate-500">/mês</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showDetails && !showLightbox && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {displayTitle}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {fullAddress && (
                  <span className="block text-slate-600">
                    {fullAddress}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {property.description && (
                <div>
                  <h3 className="font-semibold text-base mb-1.5">📝 Descrição</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-base mb-2">🏠 Informações do Imóvel</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {property.rooms > 0 && (
                    <Card className="p-2.5 text-center">
                      <Bed className="h-5 w-5 mx-auto mb-1.5 text-blue-600" />
                      <p className="text-xs text-slate-600">Quartos</p>
                      <p className="text-base font-bold">{property.rooms}</p>
                    </Card>
                  )}
                  {property.bathrooms > 0 && (
                    <Card className="p-2.5 text-center">
                      <Bath className="h-5 w-5 mx-auto mb-1.5 text-blue-600" />
                      <p className="text-xs text-slate-600">Banheiros</p>
                      <p className="text-base font-bold">{property.bathrooms}</p>
                    </Card>
                  )}
                  {property.area > 0 && (
                    <Card className="p-2.5 text-center">
                      <Maximize className="h-5 w-5 mx-auto mb-1.5 text-blue-600" />
                      <p className="text-xs text-slate-600">Área</p>
                      <p className="text-base font-bold">{property.area}m²</p>
                    </Card>
                  )}
                  {property.hasGarage && (
                    <Card className="p-2.5 text-center">
                      <Car className="h-5 w-5 mx-auto mb-1.5 text-blue-600" />
                      <p className="text-xs text-slate-600">Garagem</p>
                      <p className="text-base font-bold">Sim</p>
                    </Card>
                  )}
                </div>
              </div>

              {(property.hasFurniture || property.acceptsPets || property.hasGarage || property.hasBarbecue) && (
                <div>
                  <h3 className="font-semibold text-base mb-2">✨ Detalhes Adicionais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {property.hasFurniture && (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                        <Armchair className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="text-xs font-medium">Móveis Planejados</p>
                          <Badge variant="default" className="mt-0.5 text-xs">
                            ✅ Sim
                          </Badge>
                        </div>
                      </div>
                    )}
                    {property.acceptsPets && (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                        <PawPrint className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="text-xs font-medium">Aceita Pets</p>
                          <Badge variant="default" className="mt-0.5 text-xs">
                            ✅ Sim
                          </Badge>
                        </div>
                      </div>
                    )}
                    {property.hasGarage && (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                        <Car className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="text-xs font-medium">Vaga de Garagem</p>
                          <Badge variant="default" className="mt-0.5 text-xs">
                            ✅ Sim
                          </Badge>
                        </div>
                      </div>
                    )}
                    {property.hasBarbecue && (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                        <Flame className="h-4 w-4 text-slate-600" />
                        <div>
                          <p className="text-xs font-medium">Churrasqueira</p>
                          <Badge variant="default" className="mt-0.5 text-xs">
                            ✅ Sim
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                <h3 className="font-semibold text-base mb-2">💰 Valores</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold">
                      {property.listingType === "sale" ? "Valor Venda:" : "Valor Mensal:"}
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      {property.value.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={() => setShowInterestForm(true)}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Tenho Interesse!
                </Button>
                <ShareButtons
                  propertyName={displayTitle}
                  propertyUrl={`/imovel/${formatPublicCode(property)}`}
                />
              </div>

              {images.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Galeria de Fotos ({images.length})
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Clique em uma foto para visualizar em tela cheia
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {images.map((imageUrl, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleThumbnailClick(idx, e)}
                        className="relative aspect-square overflow-hidden rounded-lg border-2 border-slate-200 hover:border-blue-500 transition-all hover:scale-105 group"
                      >
                        <img
                          src={imageUrl}
                          alt={`${displayTitle} - Foto ${idx + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <InterestFormDialog
        open={showInterestForm}
        onOpenChange={setShowInterestForm}
        propertyName={displayTitle}
        propertyId={property.id}
      />

      {showLightbox && (
        <Lightbox
          images={images.map((url, index) => ({
            url: url,
            alt: `${displayTitle} - Foto ${index + 1}`,
          }))}
          currentIndex={lightboxIndex}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}