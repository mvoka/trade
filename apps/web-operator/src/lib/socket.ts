import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface SocketEvents {
  // Inbound events
  'job:created': (job: JobUpdate) => void;
  'job:updated': (job: JobUpdate) => void;
  'job:status_changed': (data: JobStatusChange) => void;
  'job:escalated': (data: JobEscalation) => void;
  'job:sla_warning': (data: SlaWarning) => void;
  'job:sla_breach': (data: SlaBreach) => void;
  'dispatch:attempt': (data: DispatchAttemptEvent) => void;
  'dispatch:response': (data: DispatchResponse) => void;
  'alert:new': (alert: AlertEvent) => void;
  'queue:refresh': () => void;

  // Outbound events
  'operator:subscribe': (rooms: string[]) => void;
  'operator:unsubscribe': (rooms: string[]) => void;
}

export interface JobUpdate {
  id: string;
  referenceNumber: string;
  status: string;
  slaPercentage: number;
  escalated: boolean;
  updatedAt: string;
}

export interface JobStatusChange {
  jobId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
}

export interface JobEscalation {
  jobId: string;
  referenceNumber: string;
  reason: string;
  timestamp: string;
}

export interface SlaWarning {
  jobId: string;
  referenceNumber: string;
  slaPercentage: number;
  deadline: string;
}

export interface SlaBreach {
  jobId: string;
  referenceNumber: string;
  breachTime: string;
  deadline: string;
}

export interface DispatchAttemptEvent {
  jobId: string;
  proId: string;
  proName: string;
  timestamp: string;
}

export interface DispatchResponse {
  jobId: string;
  proId: string;
  accepted: boolean;
  reason?: string;
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  type: string;
  jobId: string;
  jobReference: string;
  message: string;
  createdAt: string;
}

class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.isConnecting = true;

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Subscribe to operator channel
        this.socket?.emit('operator:subscribe', ['operator:queue', 'operator:alerts']);

        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.isConnecting = false;
          reject(new Error('Failed to connect to socket server'));
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
        this.socket?.emit('operator:subscribe', ['operator:queue', 'operator:alerts']);
      });

      // Setup event forwarding
      this.setupEventForwarding();
    });
  }

  private setupEventForwarding(): void {
    const events: (keyof SocketEvents)[] = [
      'job:created',
      'job:updated',
      'job:status_changed',
      'job:escalated',
      'job:sla_warning',
      'job:sla_breach',
      'dispatch:attempt',
      'dispatch:response',
      'alert:new',
      'queue:refresh',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          callbacks.forEach((callback) => callback(data));
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.emit('operator:unsubscribe', ['operator:queue', 'operator:alerts']);
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof SocketEvents>(event: K, ...args: Parameters<SocketEvents[K]>): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else {
      console.warn('[Socket] Cannot emit, not connected');
    }
  }

  subscribeToJob(jobId: string): void {
    this.emit('operator:subscribe' as keyof SocketEvents, [`job:${jobId}`] as any);
  }

  unsubscribeFromJob(jobId: string): void {
    this.emit('operator:unsubscribe' as keyof SocketEvents, [`job:${jobId}`] as any);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketManager = new SocketManager();
