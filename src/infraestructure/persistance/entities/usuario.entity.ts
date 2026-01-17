import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

@Entity('usuarios')
export class UsuarioEntity {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ name: 'username', type: 'varchar' })
  username: string;

  @Column({ name: 'email', type: 'text', nullable: false })
  email: string;

  @Column({ name: 'password', type: 'text', nullable: false })
  password: string;

  @Column({ name: 'estado', type: 'int', nullable: false })
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
