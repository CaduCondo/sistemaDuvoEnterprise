import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Trash2, Camera, MapPin } from "lucide-react";
import type { Property } from "@/types";
import { memo, useMemo } from "react";

interface PropertyCardProps {
  property: Property;
  onCardClick: (property: Property) => void;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  locationName?: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  available: "default",
  occupied: "secondary",
  unavailable: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  occupied: "Ocupado",
  unavailable: "Indisponível",
};

export const PropertyCard = memo(function PropertyCard({ 
  property, 
  onCardClick, 
  onDeleteClick, 
  locationName 
}: PropertyCardProps) {
  const statusBadge = useMemo(() => (
    <Badge variant={STATUS_VARIANTS[property.status]} className="text-xs font-medium px-2 py-0.5">
      {STATUS_LABELS[property.status]}
    </Badge>
  ), [property.status]);

  const hasImages = property.images && property.images.length > 0;
  const displayPrice = useMemo(() => 
    property.value?.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }), [property.value]
  );

  const roomsText = useMemo(() => 
    property.rooms === 1 ? 'Quarto' : 'Quartos', 
    [property.rooms]
  );

  const bathroomsText = useMemo(() => 
    property.bathrooms === 1 ? 'Banheiro' : 'Banheiros', 
    [property.bathrooms]
  );

  return (
    <Card 
      className="card-hover-effect touch-target-card border shadow-sm hover:shadow-md transition-shadow w-full"
      onClick={() => onCardClick(property)}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="flex-1 min-w-0">
            {locationName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{locationName}</span>
              </div>
            )}
            <h3 className="text-xl font-bold text-primary leading-tight line-clamp-1 break-words">
              {property.location}
            </h3>
            {(property.complement || property.propertyIdentifier) && (
              <p className="text-base text-muted-foreground line-clamp-1 break-words">
                {property.complement || property.propertyIdentifier}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {statusBadge}
            {hasImages && (
              <div 
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded-md" 
                title={`${property.images?.length || 0} foto${property.images?.length === 1 ? '' : 's'}`}
              >
                <Camera className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium text-blue-600">{property.images?.length || 0}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-2 w-full">
        {property.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed break-words whitespace-pre-line">
            {property.description}
          </p>
        )}

        {(property.rooms || property.bathrooms) && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {property.rooms && (
              <div className="flex items-center gap-1">
                <Bed className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{property.rooms} {roomsText}</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{property.bathrooms} {bathroomsText}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 mt-2 border-t gap-2 w-full">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xl font-bold text-primary truncate">
              {displayPrice}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => onDeleteClick(e, property.id)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});