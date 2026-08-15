import { useState, useEffect } from "react";
import { Property } from "@/types";
import type { SortOption } from "@/components/public/SortSelector";
import { propertyService } from "@/services";

interface UsePublicPropertiesOptions {
  location?: string;
  sort?: SortOption;
}

/**
 * Função para aplicar ordenação aos imóveis
 */
function applySorting(properties: Property[], sort?: SortOption): Property[] {
  // Ordenação aleatória (embaralhar array)
  if (sort === "random") {
    const shuffled = [...properties];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Mais recentes (padrão se não especificado)
  if (!sort || sort === "newest") {
    return [...properties].sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  switch (sort) {
    case "price-asc":
      return [...properties].sort((a, b) => (a.value || 0) - (b.value || 0));

    case "price-desc":
      return [...properties].sort((a, b) => (b.value || 0) - (a.value || 0));

    case "area-desc":
      return [...properties].sort((a, b) => (b.area || 0) - (a.area || 0));

    default:
      return properties;
  }
}

export function usePublicProperties({ location, sort }: UsePublicPropertiesOptions) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      try {
        setLoading(true);
        setError(null);

        // ✅ CORREÇÃO (ago/2026): removido o cache em memória de 5 minutos que
        // existia aqui. Ele guardava a lista de imóveis públicos na aba do
        // navegador e reaproveitava esse resultado antigo por até 5 minutos,
        // mesmo depois de um imóvel mudar de status (Disponível/Ocupado) ou
        // ser criado/editado. Isso causava a página de anúncios mostrar uma
        // lista desatualizada e diferente dependendo de quando/onde a pessoa
        // tinha aberto a página pela última vez (por isso o total de imóveis
        // podia aparecer diferente em dois aparelhos ao mesmo tempo, e um
        // imóvel recém-marcado como Disponível podia não aparecer ainda).
        // Agora a página sempre busca os dados direto do banco.
        console.log("🔄 [usePublicProperties] Carregando imóveis públicos...");

        // Carregar imóveis (já vem com primeira imagem + todas as imagens)
        const data = await propertyService.getPublicProperties();

        console.log(`✅ [usePublicProperties] ${data.length} imóveis carregados com imagens`);

        // Aplicar filtro de localização
        let filtered = data;
        if (location && location !== "all") {
          filtered = data.filter((prop: Property) => prop.locationId === location);
          console.log(`🔍 Filtrados por localização: ${filtered.length} imóveis`);
        }

        // Aplicar ordenação
        const sorted = applySorting(filtered, sort);

        // Atualizar estado com imóveis completos (com imagens)
        setProperties(sorted);

      } catch (err) {
        console.error("❌ [usePublicProperties] Erro ao carregar imóveis:", err);
        setError("Não foi possível carregar os imóveis. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [location, sort]);

  return { properties, loading, error };
}
