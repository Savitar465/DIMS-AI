import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Clasificaciones confirmadas por una persona.
 *
 * No es lo mismo que `clasificacion_cache`, que guarda lo que respondió la IA:
 * acá solo entra lo que un usuario aceptó o corrigió, así que vale como verdad
 * y tiene prioridad sobre cualquier sugerencia del modelo. Sirve para dos
 * cosas: resolver sin llamar al LLM cuando vuelve la misma mercancía, y como
 * ejemplos concretos en el prompt de clasificación.
 */
@Entity('clasificacion_aprendida')
export class ClasificacionAprendidaEntity {
  /** Hash de la descripción normalizada. Ver `hashDescripcion`. */
  @PrimaryColumn('text')
  hash: string;

  @Column('text')
  descripcion: string;

  @Column('text')
  subpartida: string;

  /**
   * Capítulo (2 dígitos). Se guarda desnormalizado porque los ejemplos del
   * prompt se buscan por capítulo, y derivarlo en cada consulta impediría
   * usar un índice.
   */
  @Index()
  @Column('text')
  capitulo: string;

  /** Cuántas veces se confirmó. Ordena los ejemplos: primero lo más asentado. */
  @Column('integer', { default: 1 })
  veces: number;

  @Column('text', { nullable: true })
  confirmadoPor: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
