import { Column, Entity, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Cambio, Mensaje } from '../../../core/domain/models/evento';

@Entity('eventos')
export class EventoEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ name: 'data', nullable: false })
  data: Mensaje|Cambio;

  @Column({ name: 'tipo', type: 'text', nullable: false })
  tipo: string;

  @Column({ name: 'usuario', nullable: false })
  usuario: ObjectId;

  @Column({ name: 'sala', nullable: false })
  sala: ObjectId;

  @Column({ name: 'usuariosMencionados', type: 'array', nullable: false })
  usuariosMencionados: ObjectId[];

  @Column({ name: 'estado', type: 'integer', nullable: false })
  estado: number;

  @Column({ name: 'usuCre', type: 'text', nullable: false })
  usuCre: string;

  @Column({ name: 'fecCre', type: 'timestamp', nullable: false })
  fecCre: Date;

  @Column({ name: 'usuMod', type: 'text', nullable: false })
  usuMod: string;

  @Column({ name: 'fecMod', type: 'timestamp', nullable: false })
  fecMod: Date;
}
