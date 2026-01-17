import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { UsuarioRepository } from 'src/core/domain/ports/outbound/usuario.repository';
import { UsuarioEntity } from 'src/infraestructure/persistance/entities/usuario.entity';
import { Usuario } from 'src/core/domain/models/usuario';
import { ObjectId } from 'mongodb';
import { CriteriaQuery, getOrder, getWhere } from 'src/infraestructure/shared/criteria/type-orm.helper';
import { PaginatedResource } from '../../shared/criteria/paginated-resource';
import { usuarioMetaModel } from '../../persistance/metamodel/usuario-meta-model';

@Injectable()
export class OrmUsuarioRepository implements UsuarioRepository {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly userRepository: MongoRepository<UsuarioEntity>,
  ) {
  }

  async save(usuario: Usuario): Promise<UsuarioEntity> {
    const usuarioEntity: UsuarioEntity = {
      _id: new ObjectId(),
      username: usuario.username,
      email: usuario.email,
      password: usuario.password,
      usuCre: usuario.usuCre,
      fecCre: usuario.fecCre,
      usuMod: usuario.usuMod,
      fecMod: usuario.fecMod,
      estado: usuario.estado,
    };
    return this.userRepository.save(usuarioEntity);
  }

  async findById(id: string): Promise<Usuario> {
    const objectId = new ObjectId(id);
    const usuarioE: UsuarioEntity = await this.userRepository.findOneBy({ where: { _id: objectId } });
    return Usuario.fromEntity(usuarioE);
  }

  async searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Usuario>> {
    const where = getWhere(criteria.filter, usuarioMetaModel);
    const order = getOrder(criteria.sort);
    let query: any;
    if (criteria.pagination) {
      query = {
        where,
        order,
        take: criteria.pagination.limit,
        skip: criteria.pagination.offset,
      };
    } else {
      query = {
        where,
        order,
      };
    }
    let [usuariosE, total] = await this.userRepository.findAndCount(query);

    return {
      items: usuariosE.map((usuarioE) => Usuario.fromEntity(usuarioE)),
      totalItems: total,
      page: criteria.pagination ? criteria.pagination.page : 0,
      size: criteria.pagination ? criteria.pagination.size : total,
    };
  }

  async update(usuario: Usuario): Promise<UsuarioEntity> {
    const usuarioEntity: UsuarioEntity = {
      _id: new ObjectId(usuario.id),
      username: usuario.username,
      email: usuario.email,
      password: usuario.password,
      usuCre: usuario.usuCre,
      fecCre: usuario.fecCre,
      usuMod: usuario.usuMod,
      fecMod: usuario.fecMod,
      estado: usuario.estado,
    };
    return this.userRepository.save(usuarioEntity);
  }
}