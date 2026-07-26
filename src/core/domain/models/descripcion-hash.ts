import { createHash } from 'crypto';

/**
 * Hash de una descripción de producto, para indexar cache y aprendizaje.
 *
 * Normaliza a minúsculas, sin acentos, sin puntuación, con las palabras únicas
 * en orden alfabético. Así "Mouse USB" y "USB mouse" colapsan a la misma
 * entrada — que es lo que se quiere: la misma mercancía descrita en distinto
 * orden es la misma mercancía.
 *
 * Vive acá y no dentro de un caso de uso porque lo comparten el cache de IA y
 * la tabla de clasificaciones aprendidas: si las dos normalizaran distinto, un
 * código confirmado por el usuario nunca volvería a encontrarse.
 */
export function hashDescripcion(desc: string): string {
  const norm = (desc || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .sort()
    .join(' ');
  return createHash('sha256').update(norm).digest('hex');
}
