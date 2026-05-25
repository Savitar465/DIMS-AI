import { Column, Entity, PrimaryColumn } from 'typeorm';
import { LineaId } from '../../../core/domain/models/subpartida';

@Entity('subpartidas')
export class SubpartidaEntity {
  @PrimaryColumn('text')
  code: string;

  @Column('text')
  desc: string;

  @Column('text')
  linea: LineaId;

  @Column('real', { default: 0 })
  arancel: number;

  @Column('real', { default: 0 })
  iva: number;

  @Column('real', { default: 0 })
  ice: number;

  @Column('text')
  gravamen: string;
}
