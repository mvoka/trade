import { create } from 'zustand';
import { operatorApi, Alert } from '../api';

interface AlertsState {
  alerts: Alert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAlerts: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  dismissAlert: (alertId: string) => Promise<void>;
  dismissAllAlerts: () => void;
  clearAlerts: () => void;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null });

    try {
      const alerts = await operatorApi.getAlerts();
      const unreadCount = alerts.filter((a) => !a.dismissed).length;

      set({
        alerts,
        unreadCount,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch alerts',
        isLoading: false,
      });
    }
  },

  addAlert: (alert: Alert) => {
    set((state) => {
      // Avoid duplicates
      if (state.alerts.some((a) => a.id === alert.id)) {
        return state;
      }

      const newAlerts = [alert, ...state.alerts].slice(0, 50); // Keep max 50 alerts
      return {
        alerts: newAlerts,
        unreadCount: state.unreadCount + (alert.dismissed ? 0 : 1),
      };
    });
  },

  dismissAlert: async (alertId: string) => {
    try {
      await operatorApi.dismissAlert(alertId);

      set((state) => {
        const alert = state.alerts.find((a) => a.id === alertId);
        const wasUnread = alert && !alert.dismissed;

        return {
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, dismissed: true } : a
          ),
          unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
        };
      });
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  },

  dismissAllAlerts: () => {
    const { alerts } = get();
    alerts.forEach((alert) => {
      if (!alert.dismissed) {
        operatorApi.dismissAlert(alert.id).catch(console.error);
      }
    });

    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, dismissed: true })),
      unreadCount: 0,
    }));
  },

  clearAlerts: () => {
    set({ alerts: [], unreadCount: 0 });
  },
}));

// Helper to get alert priority
export function getAlertPriority(type: Alert['type']): number {
  switch (type) {
    case 'SLA_BREACH':
      return 1;
    case 'ESCALATION':
      return 2;
    case 'DISPATCH_FAILURE':
      return 3;
    case 'SLA_WARNING':
      return 4;
    default:
      return 5;
  }
}

// Helper to get alert color
export function getAlertColor(type: Alert['type']): string {
  switch (type) {
    case 'SLA_BREACH':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'ESCALATION':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'DISPATCH_FAILURE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'SLA_WARNING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
