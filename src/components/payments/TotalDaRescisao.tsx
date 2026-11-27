import { formatCurrency } from "@/lib/masks";
import { sentidoDoTotalDaRescisao, textoDoSentido } from "@/lib/totalDaRescisao";

interface TotalDaRescisaoProps {
  /** VALOR TOTAL deste recebimento (já com multa, juros, desconto...). */
  finalTotal: number;
  /** Soma dos OUTROS recebimentos da mesma locação que vencem no mesmo dia. */
  somaOutrosDoMesmoVencimento: number;
}

/**
 * "VALOR TOTAL DA RESCISÃO" (#53): soma deste recebimento com os outros do mesmo
 * vencimento, com os dois valores que compõem o total e o SENTIDO do dinheiro
 * (a pagar ao inquilino x a receber dele).
 */
export function TotalDaRescisao({ finalTotal, somaOutrosDoMesmoVencimento }: TotalDaRescisaoProps) {
  const total = finalTotal + somaOutrosDoMesmoVencimento;
  const sentido = sentidoDoTotalDaRescisao(total);
  const mostra = (v: number) => `${v < 0 ? "-" : ""}${formatCurrency(Math.abs(v))}`;

  return (
    <div className="pt-2 mt-1 border-t border-dashed space-y-1" data-testid="total-da-rescisao">
      <div className="flex justify-between">
        <span className="font-bold text-base">VALOR TOTAL DA RESCISÃO</span>
        <span className={`font-bold text-base ${total < 0 ? "text-red-600" : "text-primary"}`} data-testid="total-da-rescisao-valor">
          {mostra(total)}
        </span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Este recebimento</span>
        <span>{mostra(finalTotal)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Outros recebimentos do mesmo vencimento</span>
        <span>{mostra(somaOutrosDoMesmoVencimento)}</span>
      </div>
      <p
        className={`text-sm font-semibold ${sentido === "pagar_ao_inquilino" ? "text-red-600" : sentido === "receber_do_inquilino" ? "text-green-700" : "text-muted-foreground"}`}
        data-testid="total-da-rescisao-sentido"
      >
        {textoDoSentido(total)}
      </p>
    </div>
  );
}
