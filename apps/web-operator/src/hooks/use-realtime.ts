'use client';

import { useEffect, useCallback, useState } from 'react';
import { socketManager, JobUpdate, SlaWarning, SlaBreach, AlertEvent } from '@/lib/socket';
import { useQueueStore } from '@/lib/stores/queue-store';
import { useAlertsStore } from '@/lib/stores/alerts-store';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useRealtime() {
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthStore();
  const { updateJob, addJob, refreshQueue } = useQueueStore();
  const { addAlert, fetchAlerts } = useAlertsStore();

  useEffect(() => {
    if (!token) return;

    const connectSocket = async () => {
      try {
        await socketManager.connect(token);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to socket:', error);
        setIsConnected(false);
      }
    };

    connectSocket();

    // Set up event listeners
    const unsubJobCreated = socketManager.on('job:created', (job: any) => {
      addJob(job);
    });

    const unsubJobUpdated = socketManager.on('job:updated', (job: JobUpdate) => {
      updateJob(job as any);
    });

    const unsubJobStatusChanged = socketManager.on('job:status_changed', (data) => {
      updateJob({ id: data.jobId, status: data.newStatus as any });
    });

    const unsubJobEscalated = socketManager.on('job:escalated', (data) => {
      updateJob({ id: data.jobId, escalated: true });
      addAlert({
        id: `escalation-${data.jobId}-${Date.now()}`,
        type: 'ESCALATION',
        jobId: data.jobId,
        jobReference: data.referenceNumber,
        message: `Job ${data.referenceNumber} has been escalated: ${data.reason}`,
        createdAt: data.timestamp,
        dismissed: false,
      });
    });

    const unsubSlaWarning = socketManager.on('job:sla_warning', (data: SlaWarning) => {
      updateJob({ id: data.jobId, slaPercentage: data.slaPercentage });
      addAlert({
        id: `sla-warning-${data.jobId}-${Date.now()}`,
        type: 'SLA_WARNING',
        jobId: data.jobId,
        jobReference: data.referenceNumber,
        message: `SLA warning: Job ${data.referenceNumber} is at ${data.slaPercentage}% of deadline`,
        createdAt: new Date().toISOString(),
        dismissed: false,
      });
    });

    const unsubSlaBreach = socketManager.on('job:sla_breach', (data: SlaBreach) => {
      updateJob({ id: data.jobId, slaPercentage: 100 });
      addAlert({
        id: `sla-breach-${data.jobId}-${Date.now()}`,
        type: 'SLA_BREACH',
        jobId: data.jobId,
        jobReference: data.referenceNumber,
        message: `SLA BREACH: Job ${data.referenceNumber} has exceeded its deadline`,
        createdAt: data.breachTime,
        dismissed: false,
      });
    });

    const unsubNewAlert = socketManager.on('alert:new', (alert: AlertEvent) => {
      addAlert({
        ...alert,
        type: alert.type as any,
        dismissed: false,
      });
    });

    const unsubQueueRefresh = socketManager.on('queue:refresh', () => {
      refreshQueue();
    });

    // Fetch initial alerts
    fetchAlerts();

    return () => {
      unsubJobCreated();
      unsubJobUpdated();
      unsubJobStatusChanged();
      unsubJobEscalated();
      unsubSlaWarning();
      unsubSlaBreach();
      unsubNewAlert();
      unsubQueueRefresh();
    };
  }, [token, updateJob, addJob, refreshQueue, addAlert, fetchAlerts]);

  return {
    isConnected,
  };
}

export function useJobRealtime(jobId: string) {
  const { updateJob } = useQueueStore();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Subscribe to job-specific updates
    socketManager.subscribeToJob(jobId);

    const unsubJobUpdated = socketManager.on('job:updated', (job: JobUpdate) => {
      if (job.id === jobId) {
        updateJob(job as any);
        setLastUpdate(new Date());
      }
    });

    const unsubStatusChanged = socketManager.on('job:status_changed', (data) => {
      if (data.jobId === jobId) {
        updateJob({ id: data.jobId, status: data.newStatus as any });
        setLastUpdate(new Date());
      }
    });

    const unsubDispatchAttempt = socketManager.on('dispatch:attempt', (data) => {
      if (data.jobId === jobId) {
        setLastUpdate(new Date());
      }
    });

    const unsubDispatchResponse = socketManager.on('dispatch:response', (data) => {
      if (data.jobId === jobId) {
        setLastUpdate(new Date());
      }
    });

    return () => {
      socketManager.unsubscribeFromJob(jobId);
      unsubJobUpdated();
      unsubStatusChanged();
      unsubDispatchAttempt();
      unsubDispatchResponse();
    };
  }, [jobId, updateJob]);

  return {
    lastUpdate,
  };
}

// Polling fallback for when WebSocket is not available
export function usePolling(intervalMs: number = 30000) {
  const { refreshQueue } = useQueueStore();
  const { fetchAlerts } = useAlertsStore();
  const [isPolling, setIsPolling] = useState(false);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      refreshQueue();
      fetchAlerts();
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [isPolling, intervalMs, refreshQueue, fetchAlerts]);

  return {
    isPolling,
    startPolling,
    stopPolling,
  };
}
