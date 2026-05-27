import { WebSocketServer } from 'ws';

export class WebSocketManager {
  constructor(server, playerManager, scanner) {
    this.wss = new WebSocketServer({ server });
    this.playerManager = playerManager;
    this.scanner = scanner;
    this.clients = new Set();

    this._setupServer();
    this._setupListeners();
  }

  _setupServer() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`[WS] Client connected (${this.clients.size} total)`);

      // Send initial state
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          players: this.playerManager.getAllStates(),
          scanner: this.scanner.getProgress(),
        },
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected (${this.clients.size} total)`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  _setupListeners() {
    // Forward player state changes to all clients
    this.playerManager.on('stateChange', ({ playerId, state }) => {
      this.broadcast({
        type: 'playerState',
        playerId,
        data: state,
      });
    });

    // Forward scanner progress to all clients
    this.scanner.on('progress', (progress) => {
      this.broadcast({
        type: 'scanProgress',
        data: progress,
      });
    });

    this.scanner.on('complete', (results) => {
      this.broadcast({
        type: 'scanComplete',
        data: results,
      });
    });

    // Forward play mode changes
    this.playerManager.on('playModeChange', (modes) => {
      this.broadcast({ type: 'playModeChange', data: modes });
    });

    // Forward continuous play switch events
    this.playerManager.on('continuousSwitch', (data) => {
      this.broadcast({ type: 'continuousSwitch', data });
    });

    // Forward playlist updates
    this.playerManager.on('playlistUpdate', (data) => {
      this.broadcast({ type: 'playlistUpdate', data });
    });

    this.playerManager.on('playlistComplete', () => {
      this.broadcast({ type: 'playlistComplete' });
    });
  }

  broadcast(message) {
    const json = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(json);
      }
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}
