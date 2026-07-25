import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { resolve, sep } from 'path';
import { Readable } from 'stream';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaDocumento } from '../../../domain/models/aduana';
import { ARCHIVOS_DIR } from './upload-factura.usecase';

export interface DocumentoDescarga {
  stream: Readable;
  documento: FacturaDocumento;
}

/**
 * Devuelve el archivo original tal como lo subió el usuario, para poder
 * mirarlo al lado del formulario y contrastar lo que la IA leyó.
 */
@Injectable()
export class GetFacturaDocumentoUseCase {
  constructor(
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
  ) {}

  async execute(
    facturaId: string,
    documentoId: string,
  ): Promise<DocumentoDescarga> {
    const factura = await this.facturaRepository.findById(facturaId);
    if (!factura) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'La factura no existe.' },
      });
    }

    const documento = (factura.documentos ?? []).find(
      (d) => d.id === documentoId,
    );
    if (!documento?.archivo) {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: 'Ese documento no está disponible.',
        },
      });
    }

    // Los ids vienen de la URL: se resuelve la ruta y se comprueba que no se
    // haya escapado de la carpeta de archivos antes de abrir nada.
    const ruta = resolve(ARCHIVOS_DIR, facturaId, documento.archivo);
    if (!ruta.startsWith(ARCHIVOS_DIR + sep)) {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: 'Ese documento no está disponible.',
        },
      });
    }

    // La referencia se guardó al subir, pero el archivo puede haber
    // desaparecido: sin esto el stream fallaría a mitad de la respuesta.
    try {
      await access(ruta);
    } catch {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: 'El archivo original ya no está guardado.',
        },
      });
    }

    return { stream: createReadStream(ruta), documento };
  }
}
