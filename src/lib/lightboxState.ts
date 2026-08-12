// Sinaliza globalmente que o Lightbox (visualizador de imagem em tela cheia)
// está aberto. Usa um atributo no <body> em vez de uma variável comum porque
// isso funciona de forma confiável independente de qual "cópia" do módulo o
// React/Next carregou (evita bugs sutis com Fast Refresh em desenvolvimento).
export function setLightboxOpen(open: boolean) {
  if (typeof document === "undefined") return;
  if (open) {
    document.body.setAttribute("data-lightbox-open", "true");
  } else {
    document.body.removeAttribute("data-lightbox-open");
  }
}

export function isLightboxOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.getAttribute("data-lightbox-open") === "true";
}
