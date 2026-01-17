import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';
import { CrearEventoRequest } from '../../dtos/request/evento/crear-evento.request';
import { Cambio, Mensaje } from '../../../core/domain/models/evento';
import { CommandBus } from '@nestjs/cqrs/dist/command-bus';
import { CrearEventoCommand } from '../../../core/application/commands/evento/crear-evento.command';

enum Event {
  MENSAJE = 'mensaje',
  CAMBIO = 'cambio'
}

@WebSocketGateway({ namespace: 'eventos' })
export class SaveEventoGateway implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectPinoLogger(SaveEventoGateway.name)
    private readonly log: PinoLogger,
    private readonly commandBus: CommandBus,
  ) {
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.log.info(`Cliend id:${socket.id} disconnected`);
    socket.disconnect(true);
  }

  handleConnection(@ConnectedSocket() socket: Socket) {
    this.log.info(`Roomcito id: ${socket.handshake.query.room} porfis`);
    this.log.info(`Client id:${socket.id} connected`);
    socket.join(socket.handshake.query.room);
  }

  @SubscribeMessage(Event.MENSAJE)
  async handleEvent(@MessageBody() body: CrearEventoRequest<Mensaje>, @ConnectedSocket() socket: Socket) {
    const eventoCreado = await this.commandBus.execute(
      new CrearEventoCommand<Mensaje>({
        usuario: body.usuario,
        tipo: body.tipo,
        data: body.data,
        sala: body.sala,
        usuariosMencionados: body.usuariosMencionados,
        usuAudit: body.usuAudit
      }),
    );

    this.server.to(socket.handshake.query.room).emit(Event.MENSAJE, eventoCreado);
  }

  @SubscribeMessage(Event.CAMBIO)
  async handleCambio(@MessageBody() body: CrearEventoRequest<Cambio>, @ConnectedSocket() socket: Socket) {
    const evento = await this.commandBus.execute(
      new CrearEventoCommand<Cambio>({
        usuario: body.usuario,
        tipo: body.tipo,
        data: body.data,
        sala: body.sala,
        usuariosMencionados: body.usuariosMencionados,
        usuAudit: body.usuAudit
      }),
    );

    this.server.to(socket.handshake.query.room).emit(Event.CAMBIO, evento);
  }
}
