// Monta o contrato de locação a partir dos cadastros do banco.
//
// Usado em DOIS lugares, para as duas telas sempre concordarem:
//   1) ao SALVAR uma locação nova (RentalFormDialog): se faltar qualquer dado
//      que vai no contrato, a locação NÃO é criada;
//   2) na tela "Contrato de Locação" (ContratoLocacaoDialog).
import { COLUNAS_USUARIO } from "@/lib/usuariosColunas";
import {
  gerarContratoResidencial,
  type ClausulaLocal,
  type DadosLocacao,
  type ResultadoContrato,
} from "@/lib/contrato/contratoResidencial";

function juntar(partes: (string | null | undefined)[], sep = ", "): string {
  return partes.map((p) => (p ?? "").toString().trim()).filter(Boolean).join(sep);
}

export function enderecoCompleto(o: {
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}): string {
  const ruaNumero = juntar([o.rua, o.numero], ", ");
  const cidadeUf = juntar([o.cidade, o.uf], "/");
  return juntar([ruaNumero, o.complemento, o.bairro, cidadeUf, o.cep ? `CEP ${o.cep}` : ""]);
}

export function dataDeHojeISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

export interface EntradaContrato {
  tenantId: string;
  propertyId: string;
  landlordUserId?: string | null;
  temGaragem: boolean;
  locacao: DadosLocacao;
}

export interface SaidaContrato {
  resultado: ResultadoContrato;
  nomeInquilino: string;
}

/** `db` é o cliente do Supabase (sem tipos, como nas outras telas). */
export async function montarContrato(db: any, e: EntradaContrato): Promise<SaidaContrato> {
  const [imovelR, inquilinoR, locadorR] = await Promise.all([
    db.from("properties").select("*, locations(*)").eq("id", e.propertyId).single(),
    db.from("tenants").select("*").eq("id", e.tenantId).single(),
    e.landlordUserId
      ? db.from("system_users").select(COLUNAS_USUARIO).eq("id", e.landlordUserId).single()
      : Promise.resolve({ data: null }),
  ]);

  const imovel = imovelR.data;
  const inquilino = inquilinoR.data;
  const locador = locadorR.data;
  if (!imovel || !inquilino) throw new Error("Não consegui abrir o imóvel ou o inquilino da locação.");
  const local = imovel.locations || {};

  // Local "Outros" é um coringa: o endereço está no próprio imóvel.
  const usaManual = String(local.name || "").toLowerCase() === "outros" && !!imovel.manual_street;
  const enderecoImovel = enderecoCompleto({
    rua: usaManual ? imovel.manual_street : local.street,
    numero: usaManual ? imovel.manual_number : local.number,
    complemento: imovel.complement,
    bairro: usaManual ? imovel.manual_neighborhood : local.neighborhood,
    cidade: usaManual ? imovel.manual_city : local.city,
    uf: usaManual ? imovel.manual_state : local.state,
    cep: usaManual ? imovel.manual_zip_code : local.zip_code,
  });
  const cidadeUf = juntar(
    [usaManual ? imovel.manual_city : local.city, usaManual ? imovel.manual_state : local.state],
    "/"
  );
  const clausulas: ClausulaLocal[] = Array.isArray(local.contract_clauses) ? local.contract_clauses : [];

  const resultado = gerarContratoResidencial({
    locador: {
      nome: locador?.name,
      assinaturaUrl: locador?.signature_url,
      cpf: locador?.cpf,
      rg: locador?.rg,
      endereco: locador?.landlord_address,
      cidade: locador?.landlord_city,
      banco: locador?.landlord_bank_name,
      agencia: locador?.landlord_bank_agency,
      operacao: locador?.landlord_bank_operation,
      poupanca: locador?.landlord_bank_savings,
      conta: locador?.landlord_bank_account,
      pix: locador?.landlord_pix_key,
      whatsapp: locador?.landlord_whatsapp || locador?.phone,
    },
    locatario: {
      nome: inquilino.name,
      sexo: inquilino.gender,
      estadoCivil: inquilino.marital_status,
      profissao: inquilino.occupation,
      rg: inquilino.rg,
      cpf: inquilino.document_type === "cnpj" ? null : inquilino.cpf || inquilino.document,
      tipoDocumento: inquilino.document_type,
      endereco: enderecoCompleto({
        rua: inquilino.street,
        numero: inquilino.number,
        complemento: inquilino.complement,
        bairro: inquilino.neighborhood,
        cidade: inquilino.city,
        uf: inquilino.state,
        cep: inquilino.zip_code,
      }),
    },
    imovel: {
      clausulasLocal: clausulas,
      quartos: imovel.rooms,
      banheiros: imovel.bathrooms,
      temGaragem: e.temGaragem,
      endereco: enderecoImovel,
      cidadeUf,
    },
    locacao: e.locacao,
    dataAssinatura: dataDeHojeISO(),
  });

  return { resultado, nomeInquilino: String(inquilino.name) };
}
