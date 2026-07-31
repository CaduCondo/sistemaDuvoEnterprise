import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { PublicHeader } from "@/components/public/PublicHeader";
import { ShareButtons } from "@/components/public/ShareButtons";
import { InterestFormDialog } from "@/components/public/InterestFormDialog";
import { Lightbox } from "@/components/Lightbox";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Property } from "@/types";
import {
  MapPin,
  Bed,
  Bath,
  Car,
  Maximize,
  Home,
  PawPrint,
  Armchair,
  MessageCircle,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function PropertyDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    
    const propertyId = Array.isArray(id) ? id[0] : id;
    if (!propertyId) return;

    async function fetchProperty() {
      try {
        setLoading(true);
        setError(null);

        // 🔥 Buscar imóvel COM imagens (query completa)
        const { data, error: fetchError } = await supabase
          .from("properties")
          .select(`
            *,
            locations!properties_location_id_fkey (
              id,
              name,
              street,
              number,
              neighborhood,
              city,
              state,
              zip_code
            )
          `)
          .eq("id", propertyId)
          .eq("status", "available")
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Imóvel não encontrado");

        // 🔥 Processar imagens do campo JSONB
        const allImages: string[] = [];
        if (data.images && Array.isArray(data.images)) {
          data.images.forEach((img: any) => {
            if (img && typeof img === 'string' && img.length > 0) {
              allImages.push(img);
            }
          });
        }

        const location = data.locations;
        const mappedProperty: Property = {
          id: data.id,
          locationId: location?.id || "",
          location: location?.name || "",
          address: location?.street || "",
          number: location?.number || "",
          complement: data.complement || "",
          neighborhood: location?.neighborhood || "",
          city: location?.city || "",
          state: location?.state || "",
          zipCode: location?.zip_code || "",
          rooms: data.rooms || 0,
          bathrooms: data.bathrooms || 0,
          area: data.area || 0,
          status: (data.status as "available" | "unavailable" | "occupied") || "available",
          value: data.value || 0,
          propertyIdentifier: data.property_identifier || "",
          description: data.description || "",
          hasGarage: data.has_garage || false,
          hasFurniture: data.has_furniture || false,
          acceptsPets: data.accepts_pets || false,
          images: allImages,
          allImages: allImages,
          features: [],
          createdAt: data.created_at,
        };

        setProperty(mappedProperty);
      } catch (err: any) {
        console.error("Erro ao buscar imóvel:", err);
        setError(err.message || "Erro ao carregar imóvel");
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Carregando imóvel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto px-4">
            <Home className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Imóvel não encontrado</h1>
            <p className="text-slate-600 mb-6">{error || "O imóvel que você procura não está mais disponível."}</p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const images = property.allImages || property.images || [];
  const displayTitle = property.location || property.propertyIdentifier || "Localização não informada";

  const addressParts = [];
  if (property.address) addressParts.push(property.address);
  if (property.complement && property.complement.trim() !== "") addressParts.push(property.complement);
  if (property.neighborhood) addressParts.push(property.neighborhood);
  if (property.city) addressParts.push(property.city);
  if (property.state) addressParts.push(property.state);

  const fullAddress = addressParts.join(", ");

  const handleThumbnailClick = (index: number) => {
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const lightboxFiles = images.map((url, index) => ({
    name: `Foto ${index + 1}`,
    url: url,
    type: "image/jpeg",
  }));

  return (
    <>
      <Head>
        <title>{displayTitle} - Imóvel para Locação</title>
        <meta name="description" content={property.description || `${displayTitle} - R$ ${property.value.toLocaleString("pt-BR")}/mês`} />
        <meta property="og:title" content={`${displayTitle} - Imóvel para Locação`} />
        <meta property="og:description" content={property.description || `Confira este imóvel - R$ ${property.value.toLocaleString("pt-BR")}/mês`} />
        <meta property="og:type" content="website" />
        {images[0] && <meta property="og:image" content={images[0]} />}
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <PublicHeader />

        <div className="container mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="outline" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para início
            </Button>
          </Link>

          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{displayTitle}</h1>
                  {fullAddress && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <span>{fullAddress}</span>
                    </div>
                  )}
                </div>
                <ShareButtons propertyName={displayTitle} propertyUrl={`/imovel/${property.id}`} />
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Valor Mensal</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {property.value.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                      <span className="text-lg font-normal text-slate-600">/mês</span>
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowInterestForm(true)}
                    className="bg-green-500 hover:bg-green-600"
                    size="lg"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Tenho Interesse!
                  </Button>
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <button
                      onClick={() => handleThumbnailClick(0)}
                      className="relative w-full aspect-video overflow-hidden rounded-lg hover:opacity-95 transition-opacity"
                    >
                      <img
                        src={images[0]}
                        alt={`${displayTitle} - Principal`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  </div>
                  {images.slice(1, 5).map((imageUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleThumbnailClick(idx + 1)}
                      className="relative aspect-video overflow-hidden rounded-lg hover:opacity-95 transition-opacity"
                    >
                      <img
                        src={imageUrl}
                        alt={`${displayTitle} - Foto ${idx + 2}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
                {images.length > 5 && (
                  <Button
                    onClick={() => handleThumbnailClick(0)}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Ver todas as {images.length} fotos
                  </Button>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {property.description && (
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">Descrição</h2>
                    <p className="text-slate-600 leading-relaxed">{property.description}</p>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">Características</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {property.rooms > 0 && (
                        <Card className="p-4 text-center">
                          <Bed className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-slate-600">Quartos</p>
                          <p className="text-xl font-bold">{property.rooms}</p>
                        </Card>
                      )}
                      {property.bathrooms > 0 && (
                        <Card className="p-4 text-center">
                          <Bath className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-slate-600">Banheiros</p>
                          <p className="text-xl font-bold">{property.bathrooms}</p>
                        </Card>
                      )}
                      {property.area > 0 && (
                        <Card className="p-4 text-center">
                          <Maximize className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-slate-600">Área</p>
                          <p className="text-xl font-bold">{property.area}m²</p>
                        </Card>
                      )}
                      {property.hasGarage && (
                        <Card className="p-4 text-center">
                          <Car className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-slate-600">Garagem</p>
                          <p className="text-xl font-bold">Sim</p>
                        </Card>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-3">Detalhes</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Armchair className="h-5 w-5 text-slate-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Móveis Planejados</p>
                      <Badge variant={property.hasFurniture ? "default" : "secondary"} className="mt-1">
                        {property.hasFurniture ? "Sim" : "Não"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <PawPrint className="h-5 w-5 text-slate-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Aceita Pets</p>
                      <Badge variant={property.acceptsPets ? "default" : "secondary"} className="mt-1">
                        {property.acceptsPets ? "Sim" : "Não"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Car className="h-5 w-5 text-slate-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Vaga de Garagem</p>
                      <Badge variant={property.hasGarage ? "default" : "secondary"} className="mt-1">
                        {property.hasGarage ? "Sim" : "Não"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowInterestForm(true)}
                  className="w-full bg-green-500 hover:bg-green-600 mt-6"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Tenho Interesse!
                </Button>
              </div>
            </div>
          </div>
        </div>

        <WhatsAppButton />

        <InterestFormDialog
          open={showInterestForm}
          onOpenChange={setShowInterestForm}
          propertyName={displayTitle}
          propertyId={property.id}
        />

        {lightboxOpen && (
          <Lightbox
            images={images.map((url, index) => ({
              url: url,
              alt: `${displayTitle} - Foto ${index + 1}`,
            }))}
            currentIndex={lightboxIndex}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            onNavigate={setLightboxIndex}
          />
        )}
      </div>
    </>
  );
}