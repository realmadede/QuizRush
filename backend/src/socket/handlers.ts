import { Server, Socket } from 'socket.io';
import { prisma } from '../index';

/**
 * Initialize Socket.IO event handlers
 */
export function initializeSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('🔌 Player connected:', socket.id);

    // Join session room
    socket.on(
      'join_session',
      async (data: { sessionId: string; playerId: string; token: string }) => {
        try {
          // Verify player
          const player = await prisma.player.findUnique({
            where: { id: data.playerId },
          });

          if (!player || player.token !== data.token) {
            socket.emit('error', 'Unauthorized');
            return;
          }

          // Join room
          socket.join(`session:${data.sessionId}`);
          socket.data = { sessionId: data.sessionId, playerId: data.playerId };

          console.log(`Player ${data.playerId} joined session ${data.sessionId}`);

          // Mark player as connected
          await prisma.player.update({
            where: { id: data.playerId },
            data: { connected: true },
          });

          // Notify others
          socket.to(`session:${data.sessionId}`).emit('player_connected', {
            playerId: data.playerId,
          });
        } catch (error) {
          console.error('Error joining session:', error);
          socket.emit('error', 'Failed to join session');
        }
      }
    );

    // Host joins session room
    socket.on('join_host', async (data: { sessionId: string; userId: string }) => {
      try {
        const session = await prisma.gameSession.findUnique({
          where: { id: data.sessionId },
        });

        if (!session || session.hostId !== data.userId) {
          socket.emit('error', 'Unauthorized');
          return;
        }

        socket.join(`session:${data.sessionId}:host`);
        socket.data = { sessionId: data.sessionId, userId: data.userId, isHost: true };

        console.log(`Host joined session ${data.sessionId}`);
      } catch (error) {
        console.error('Error host joining session:', error);
        socket.emit('error', 'Failed to join session');
      }
    });

    // Spectator joins (projector mode)
    socket.on('join_spectator', async (data: { sessionId: string }) => {
      socket.join(`session:${data.sessionId}:spectator`);
      socket.data = { sessionId: data.sessionId, isSpectator: true };
      console.log(`Spectator joined session ${data.sessionId}`);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('🔌 Player disconnected:', socket.id);

      if (socket.data?.playerId) {
        try {
          // Mark player as disconnected (but keep in session)
          await prisma.player.update({
            where: { id: socket.data.playerId },
            data: { connected: false },
          });

          // Notify others
          socket.to(`session:${socket.data.sessionId}`).emit('player_disconnected', {
            playerId: socket.data.playerId,
          });
        } catch (error) {
          console.error('Error updating player disconnect:', error);
        }
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
}
