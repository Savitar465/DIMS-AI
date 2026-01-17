import { Column, Entity, ObjectIdColumn } from "typeorm";
import { ObjectId } from "mongodb";

@Entity('salas')
export class SalaEntity {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ name: 'usuarios', type: 'array', nullable: false })
    usuarios: ObjectId[];

    @Column({ name: 'estado', type: 'integer', nullable: false })
    estado: number;

    @Column({ name: 'usuCre', type: 'text', nullable: false })
    usuCre: string;

    @Column({ name: 'fecCre', type: 'timestamp', nullable: false })
    fecCre: Date;

    @Column({ name: 'usuMod', type: 'text', nullable: false})
    usuMod: string;

    @Column({ name: 'fecMod', type: 'timestamp', nullable: false})
    fecMod: Date;
}