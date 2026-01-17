import { Inject, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { UsuarioRepository } from '../ports/outbound/usuario.repository';
import { CrearUsuarioRequest } from 'src/interfaces/dtos/request/usuario/crear-usuario.request';
import { Usuario } from '../models/usuario';
import { UsuarioCreadoEvent } from '../events/usuario/usuario-creado.event';
import { FindUsuarioQuery } from 'src/core/application/query/usuario/find-usuario.query';
import { ConstantsRepository } from 'src/interfaces/dependency-injection/constants/constants';
import { FindUsuarioSearch } from '../../application/query/usuario/find-usuario-search.query';
import { ModificarUsuarioRequest } from '../../../interfaces/dtos/request/usuario/modificar-usuario.request';
import { DesactivarUsuarioRequest } from '../../../interfaces/dtos/request/usuario/desactivar-usuario.request';
import { UsuarioModificadoEvent } from '../events/usuario/usuario-modificado.event';

@Injectable()
export class UsuarioService {
  constructor(
    @Inject(ConstantsRepository.USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    private readonly usuarioEventBus: EventBus,
  ) {
  }

  async save(crearUsuarioRequest: CrearUsuarioRequest): Promise<Usuario> {
    const usuario = await Usuario.create({
      username: crearUsuarioRequest.username,
      email: crearUsuarioRequest.email,
      password: crearUsuarioRequest.password,
      usuAudit: crearUsuarioRequest.usuAudit,
    });

    const usuarioSavedEntity = await this.usuarioRepository.save(usuario);

    const usuarioSaved = Usuario.fromEntity(usuarioSavedEntity);

    if (usuarioSaved) {
      this.usuarioEventBus.publish(new UsuarioCreadoEvent(usuarioSaved));
    }

    return usuarioSaved;
  }

  async findById(query: FindUsuarioQuery) {
    console.log('Here you are');
    return await this.usuarioRepository.findById(query.id);
  }

  async search(query: FindUsuarioSearch) {
    return await this.usuarioRepository.searchByCriteria(query.criteria);
  }

  async update(modificarUsuarioRequest: ModificarUsuarioRequest): Promise<Usuario> {
    const usuario = await Usuario.update({
      id: modificarUsuarioRequest.id,
      username: modificarUsuarioRequest.username,
      email: modificarUsuarioRequest.email,
      password: modificarUsuarioRequest.password,
      usuAudit: modificarUsuarioRequest.usuAudit,
    });
    const usuarioSavedEntity = await this.usuarioRepository.update(usuario);

    const usuarioSaved = Usuario.fromEntity(usuarioSavedEntity);

    if (usuarioSaved) {
      this.usuarioEventBus.publish(new UsuarioModificadoEvent(usuarioSaved));
    }

    return usuarioSaved;
  }

  async deactivate(desactivarUsuarioRequest: DesactivarUsuarioRequest): Promise<Usuario> {
    const usuario = await Usuario.deactivate({
      id: desactivarUsuarioRequest.id,
      usuAudit: desactivarUsuarioRequest.usuAudit,
    });
    const usuarioSavedEntity = await this.usuarioRepository.update(usuario);

    const usuarioSaved = Usuario.fromEntity(usuarioSavedEntity);

    if (usuarioSaved) {
      this.usuarioEventBus.publish(new UsuarioModificadoEvent(usuarioSaved));
    }

    return usuarioSaved;
  }
}
