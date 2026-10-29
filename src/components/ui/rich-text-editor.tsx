import { useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Bold, Italic } from "lucide-react";
import { cn } from "@/lib/utils";

// ✅ Issue #35: editor de texto (negrito/itálico/tamanho) para o campo
// Descrição do Imóvel. Sem biblioteca de rich-text pesada (tiptap/quill) --
// um <div contentEditable> com execCommand para negrito/itálico (suportado
// em todo navegador baseado em Chromium, inclusive o do Playwright) e
// manipulação manual de seleção para o tamanho, salvando HTML simples
// (<b>, <i>, <span style="font-size:...">) no mesmo campo `description`
// que já existia como texto puro.
//
// O HTML é sanitizado (DOMPurify) tanto ao colar quanto antes de salvar --
// a descrição digitada aqui também é renderizada no anúncio público
// (src/pages/imovel/[id].tsx), então precisa ser segura mesmo que alguém
// cole conteúdo de outro site no campo.

const ALLOWED_TAGS = ["b", "strong", "i", "em", "span", "br", "div", "p"];
const ALLOWED_ATTR = ["style"];

export function sanitizeDescriptionHtml(html: string): string {
  return String(
    DOMPurify.sanitize(html || "", {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      // só permite a propriedade font-size no style, nada de position/url/etc.
      ALLOWED_STYLES: { "*": { "font-size": true } } as any,
    } as any)
  );
}

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "0.8em", label: "P" },
  { value: "1em", label: "N" },
  { value: "1.3em", label: "G" },
  { value: "1.7em", label: "XG" },
];

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sincroniza o HTML vindo de fora (ex: abrir outro imóvel para editar)
  // sem sobrescrever o que o usuário está digitando no meio disso.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      onChange(sanitizeDescriptionHtml(editorRef.current.innerHTML));
    }
  }, [onChange]);

  const exec = useCallback(
    (command: string) => {
      if (disabled) return;
      editorRef.current?.focus();
      document.execCommand(command, false);
      emitChange();
    },
    [disabled, emitChange]
  );

  const applySize = useCallback(
    (fontSize: string) => {
      if (disabled) return;
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return; // precisa de um trecho selecionado para aplicar o tamanho
      }

      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;

      try {
        const span = document.createElement("span");
        span.style.fontSize = fontSize;
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch {
        // Seleção atravessa limites de elementos (ex: parte em negrito,
        // parte fora) -- range.surroundContents não suporta isso. Fallback:
        // substitui o conteúdo selecionado por uma cópia envolta no span.
        const span = document.createElement("span");
        span.style.fontSize = fontSize;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        selection.removeAllRanges();
      }

      emitChange();
    },
    [disabled, emitChange]
  );

  return (
    <div className={className}>
      {!disabled && (
        <div className="flex items-center gap-1 border border-input border-b-0 rounded-t-md bg-muted/40 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("bold")}
            aria-label="Negrito"
            title="Negrito"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("italic")}
            aria-label="Itálico"
            title="Itálico"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          {SIZE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-semibold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySize(opt.value)}
              aria-label={`Tamanho ${opt.label}`}
              title={`Selecione um texto e clique para aplicar o tamanho ${opt.label}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}
      <div
        id={id}
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={(e) => {
          // Cola só texto/HTML sanitizado -- nunca o HTML bruto da área de
          // transferência (poderia trazer tags/estilos fora do permitido).
          e.preventDefault();
          const pastedHtml = e.clipboardData.getData("text/html");
          const pastedText = e.clipboardData.getData("text/plain");
          const safe = pastedHtml ? sanitizeDescriptionHtml(pastedHtml) : pastedText;
          document.execCommand("insertHTML", false, safe || pastedText);
          emitChange();
        }}
        data-placeholder={placeholder}
        aria-placeholder={placeholder}
        className={cn(
          "rich-text-editor-content text-sm min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
          disabled ? "opacity-70 cursor-not-allowed" : "rounded-t-none"
        )}
      />
    </div>
  );
}
