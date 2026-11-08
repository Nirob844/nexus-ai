import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from query or auth handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`Client connection rejected: No token provided (${client.id})`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>(
        'JWT_ACCESS_SECRET',
        'nexus_super_secret_jwt_access_key_change_in_production',
      );

      const payload = await this.jwtService.verifyAsync(token, { secret });
      client.data.user = payload;

      // Automatically join user personal room
      const userRoom = `user:${payload.sub}`;
      client.join(userRoom);

      // If active organization exists in token, join org room
      if (payload.activeOrganizationId) {
        client.join(`org:${payload.activeOrganizationId}`);
      }

      this.logger.log(`Client connected: ${client.id} (User: ${payload.email})`);
    } catch (err) {
      this.logger.warn(`Client authentication failed (${client.id}): ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:organization')
  handleJoinOrganization(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { organizationId: string },
  ) {
    if (data?.organizationId) {
      const room = `org:${data.organizationId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { event: 'joined:organization', room };
    }
  }

  @SubscribeMessage('join:ticket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string },
  ) {
    if (data?.ticketId) {
      const room = `ticket:${data.ticketId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { event: 'joined:ticket', room };
    }
  }

  @SubscribeMessage('leave:ticket')
  handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string },
  ) {
    if (data?.ticketId) {
      const room = `ticket:${data.ticketId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { event: 'left:ticket', room };
    }
  }

  @SubscribeMessage('ticket:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; isTyping: boolean },
  ) {
    if (data?.ticketId && client.data?.user) {
      client.to(`ticket:${data.ticketId}`).emit('ticket:typing', {
        ticketId: data.ticketId,
        user: {
          id: client.data.user.sub,
          email: client.data.user.email,
        },
        isTyping: data.isTyping,
      });
    }
  }

  // ----------------------------------------------------------------------------
  // Server-to-Client Broadcasting Helpers
  // ----------------------------------------------------------------------------

  emitTicketCreated(orgId: string, ticket: any) {
    this.server.to(`org:${orgId}`).emit('ticket:created', ticket);
  }

  emitTicketUpdated(orgId: string, ticketId: string, data: any) {
    this.server.to(`ticket:${ticketId}`).to(`org:${orgId}`).emit('ticket:updated', data);
  }

  emitNewMessage(ticketId: string, message: any) {
    this.server.to(`ticket:${ticketId}`).emit('ticket:message', message);
  }

  emitApprovalRequested(orgId: string, approval: any) {
    this.server.to(`org:${orgId}`).emit('approval:requested', approval);
  }

  emitApprovalResolved(orgId: string, approval: any) {
    this.server.to(`org:${orgId}`).emit('approval:resolved', approval);
  }

  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
