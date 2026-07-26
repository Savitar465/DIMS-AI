import { FacturaDocumento } from '../models/aduana';

/**
 * Ninguno de los documentos cargados pudo leerse.
 *
 * Es un error del lado del cliente, no una falla del servidor: el archivo no
 * era legible, no era un documento de importación, o la IA no pudo procesarlo.
 * Se lanza en vez de devolver una factura vacía con `estado: 'error'` porque un
 * 201 con todos los campos en null es indistinguible de una carga exitosa de un
 * documento sin datos, y el cliente terminaba mostrando un formulario en blanco
 * sin decir por qué.
 *
 * La factura igual queda guardada: los archivos originales ya están en disco y
 * el usuario tiene que poder verlos. Por eso viaja el `facturaId`.
 */
export class ExtraccionFallidaError extends Error {
  constructor(
    readonly facturaId: string,
    readonly documentos: FacturaDocumento[],
  ) {
    super(
      documentos.length === 1
        ? (documentos[0].error?.mensaje ??
            'No se pudo extraer información del documento.')
        : 'No se pudo extraer información de ninguno de los documentos cargados.',
    );
    this.name = 'ExtraccionFallidaError';
  }

  /** Detalle por documento, para que la UI señale cuál falló y por qué. */
  get detallePorDocumento(): Array<{
    id?: string;
    nombre: string;
    codigo: string;
    mensaje: string;
  }> {
    return this.documentos.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      codigo: d.error?.codigo ?? 'sin_datos',
      mensaje:
        d.error?.mensaje ??
        'La IA no reconoció datos aprovechables en este documento.',
    }));
  }
}
