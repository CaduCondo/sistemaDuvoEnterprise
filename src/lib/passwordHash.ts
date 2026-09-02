import bcrypt from "bcryptjs";

/**
 * Hash de senha — SÓ RODA NO SERVIDOR.
 *
 * POR QUE ISTO EXISTE (02/set/2026)
 *
 * Desde sempre, `system_users.password_hash` guardava a senha em TEXTO PURO
 * -- o nome da coluna sempre enganou. O `login.ts` comparava com `===`
 * direto, e cada rota que troca/reseta senha gravava o valor exatamente como
 * chegou. Isso já estava documentado como débito técnico conhecido (ver
 * docs/AUTHENTICATION.md, seção "Etapa 3"), mas foi o Cadu quem achou na
 * prática: rodando um `select * from system_users` em PRODUÇÃO por
 * curiosidade, viu a senha de todo mundo ali, legível.
 *
 * O risco não é só "alguém mal-intencionado com acesso ao banco hoje" --
 * é que texto puro não tem nenhuma proteção se o banco vazar um dia (backup
 * mal guardado, chave secreta exposta, etc.), e muita gente reusa a mesma
 * senha em vários lugares. Hash bcrypt não evita 100% disso, mas é a
 * diferença entre "vazou a lista de senhas de todo mundo" e "vazou uma lista
 * de hashes que precisam ser quebrados um por um".
 *
 * `bcryptjs` já era dependência do projeto (ver package.json) mas nunca
 * tinha sido usado -- só a intenção ficou registrada.
 *
 * COMO ISTO CONVIVE COM DADOS ANTIGOS
 *
 * Depois que este código for publicado, rodamos uma migration em SQL (ver
 * ticket) que transforma TODAS as senhas já gravadas (hoje em texto puro,
 * então já sabemos qual é o valor -- não é preciso adivinhar nada) em hash
 * bcrypt, usando a extensão `pgcrypto` do Postgres direto no banco. Até essa
 * migration rodar (em DEV e depois em PROD), `senhaConfere()` ainda
 * reconhece um valor em texto puro e compara direto, para o login não parar
 * de funcionar no meio do caminho. Assim que a migration rodar nos dois
 * bancos, esse caminho antigo nunca mais é usado -- pode ser removido no
 * futuro se quiser simplificar, mas não atrapalha nada continuar aqui.
 */

const CUSTO_DO_HASH = 10; // padrão recomendado pelo bcrypt; maior = mais lento e mais seguro

/** Transforma uma senha em texto puro no hash que deve ir para `password_hash`. */
export function gerarHashDeSenha(senhaEmTextoPuro: string): string {
  return bcrypt.hashSync(senhaEmTextoPuro, CUSTO_DO_HASH);
}

/** Um hash bcrypt sempre começa com "$2a$", "$2b$" ou "$2y$". */
function pareceHashBcrypt(valor: string): boolean {
  return /^\$2[aby]\$/.test(valor);
}

/**
 * Confere se a senha digitada bate com o que está gravado em
 * `password_hash` -- aceitando tanto hash bcrypt (o caso normal, depois da
 * migration) quanto texto puro (só enquanto a migration não rodou naquele
 * banco -- ver comentário no topo do arquivo).
 */
export function senhaConfere(senhaDigitada: string, valorGravado: string | null | undefined): boolean {
  if (!valorGravado) return false;

  if (pareceHashBcrypt(valorGravado)) {
    return bcrypt.compareSync(senhaDigitada, valorGravado);
  }

  // Valor antigo, ainda em texto puro (banco não migrado ainda).
  return senhaDigitada === valorGravado;
}
