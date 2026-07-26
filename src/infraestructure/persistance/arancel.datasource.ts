import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Conexión al Arancel 2026 (base `aranceles`, esquema buscador_arancelario).
 *
 * Vive en el mismo servidor Aiven que la app, pero en otra BASE de datos, no
 * solo en otro esquema. Postgres no permite consultar entre bases, así que
 * sigue haciendo falta una conexión aparte: no se puede unificar con la del
 * módulo TypeORM principal.
 *
 * `synchronize: false` a propósito: el arancel se carga desde afuera y que
 * TypeORM intente sincronizar un esquema contra él sería destructivo. No hay
 * entidades registradas; se consulta por SQL crudo contra la vista
 * materializada `buscador_arancelario.arancel_busqueda`.
 */
export const ARANCEL_DATA_SOURCE = 'ARANCEL_DATA_SOURCE';

export const arancelDataSourceProvider = {
  provide: ARANCEL_DATA_SOURCE,
  useFactory: async (): Promise<DataSource> => {
    const ds = new DataSource({
      type: 'postgres',
      host: process.env.ARANCEL_DB_HOST,
      port: parseInt(process.env.ARANCEL_DB_PORT, 10) || 5432,
      username: process.env.ARANCEL_DB_USER,
      password: process.env.ARANCEL_DB_PASSWORD,
      database: process.env.ARANCEL_DB_NAME,
      schema: 'buscador_arancelario',
      entities: [],
      synchronize: false,
      logging: false,
      // Aiven exige TLS (ARANCEL_DB_SSL=true). Se deja configurable por si la
      // base se sirve alguna vez desde un host sin TLS.
      ssl:
        process.env.ARANCEL_DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
      extra: { max: 10 },
    });
    return ds.initialize();
  },
};

/**
 * Cierra el pool al apagar la aplicación.
 *
 * Nest solo invoca `onModuleDestroy` sobre proveedores que tengan ese método,
 * y el `DataSource` de TypeORM expone `destroy()`, no ese hook: sin este
 * cierre explícito el pool queda abierto y el proceso no termina.
 */
@Injectable()
export class ArancelDataSourceCloser implements OnModuleDestroy {
  constructor(
    @Inject(ARANCEL_DATA_SOURCE) private readonly dataSource: DataSource,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
