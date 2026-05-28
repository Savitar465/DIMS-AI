import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Cache de clasificaciones de subpartidas indexada por hash de descripción
 * normalizada. La idea: si dos facturas distintas tienen un ítem con la misma
 * descripción (caso típico para importadores que reciben el mismo producto
 * de distintos proveedores), no llamamos a la IA — usamos el resultado previo.
 */
@Entity('clasificacion_cache')
export class ClasificacionCacheEntity {
  @PrimaryColumn('text')
  hash: string;

  @Column('text', { nullable: true })
  subpartida: string | null;

  @Column('integer', { default: 0 })
  confidence: number;

  @Column('text', { nullable: true })
  razon: string | null;

  @Column('text')
  descripcionMuestra: string;

  @CreateDateColumn()
  createdAt: Date;
}
