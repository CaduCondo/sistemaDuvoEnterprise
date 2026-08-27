import { formatCurrency as formatCurrencyUtil } from "@/lib/masks";

interface LateFeeInterestBlockProps {
  daysLate: number;
  lateFee: number;
  interest: number;
  /** @deprecated Nao e mais exibido aqui (ver 27/ago/2026). Mantido para nao quebrar quem ainda passa. */
  finalTotal?: number;
  includeLateFee: boolean;
  includeInterest: boolean;
  onIncludeLateFeeChange: (checked: boolean) => void;
  onIncludeInterestChange: (checked: boolean) => void;
  lateFeePercentage: number;
  interestRatePercentage: number;
  showCheckboxes?: boolean;
  disabled?: boolean;
}

export function LateFeeInterestBlock({
  daysLate,
  lateFee,
  interest,
  finalTotal: _finalTotalNaoUsado,
  includeLateFee,
  includeInterest,
  onIncludeLateFeeChange,
  onIncludeInterestChange,
  lateFeePercentage,
  interestRatePercentage,
  showCheckboxes = true,
  disabled = false,
}: LateFeeInterestBlockProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <div className="space-y-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
      <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3">
        {/* XX sempre com 2 digitos (07, nao 7). "01 dia" no singular;
            qualquer outro numero, "dias". Padronizacao pedida pelo Cadu
            em 27/ago/2026 - ver padronizacao-telas-recebimento.md. */}
        Atraso no Pagamento: {String(daysLate).padStart(2, "0")}{" "}
        {daysLate === 1 ? "dia" : "dias"}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showCheckboxes && (
              <input
                type="checkbox"
                id="includeLateFee"
                checked={includeLateFee}
                onChange={(e) => onIncludeLateFeeChange(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300"
              />
            )}
            <label 
              htmlFor="includeLateFee" 
              className={`text-sm ${showCheckboxes ? 'cursor-pointer' : ''} ${!includeLateFee ? 'line-through text-muted-foreground' : ''}`}
            >
              Multa ({lateFeePercentage}%)
            </label>
          </div>
          <span className={`font-semibold ${includeLateFee ? 'text-red-600' : 'text-muted-foreground line-through'}`}>
            {includeLateFee ? "+ " : ""}
            {formatCurrency(lateFee)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showCheckboxes && (
              <input
                type="checkbox"
                id="includeInterest"
                checked={includeInterest}
                onChange={(e) => onIncludeInterestChange(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300"
              />
            )}
            <label 
              htmlFor="includeInterest" 
              className={`text-sm ${showCheckboxes ? 'cursor-pointer' : ''} ${!includeInterest ? 'line-through text-muted-foreground' : ''}`}
            >
              Juros ({interestRatePercentage.toFixed(3)}% ao dia)
            </label>
          </div>
          <span className={`font-semibold ${includeInterest ? 'text-red-600' : 'text-muted-foreground line-through'}`}>
            {includeInterest ? "+ " : ""}
            {formatCurrency(interest)}
          </span>
        </div>

        {/* O VALOR TOTAL NAO entra aqui (nem a linha vermelha que o separava).
            O total da tela e um so, no rodape da "Formacao de Valores" - ter
            dois totais na mesma tela confundia qual era o de verdade. */}
      </div>
    </div>
  );
}