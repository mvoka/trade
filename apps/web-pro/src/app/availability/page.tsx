'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { proApi, DaySchedule, TimeSlot, UnavailablePeriod, DayOfWeek } from '@/lib/api';

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map((day) => ({
  day: day.value,
  enabled: day.value !== 'saturday' && day.value !== 'sunday',
  slots: [{ start: '09:00', end: '17:00' }],
}));

export default function AvailabilityPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [unavailablePeriods, setUnavailablePeriods] = useState<UnavailablePeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddUnavailable, setShowAddUnavailable] = useState(false);
  const [newUnavailable, setNewUnavailable] = useState<UnavailablePeriod>({
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchAvailability();
  }, [isAuthenticated, router]);

  const fetchAvailability = async () => {
    try {
      setIsLoading(true);
      const data = await proApi.getAvailability();
      if (data.schedule && data.schedule.length > 0) {
        setSchedule(data.schedule);
      }
      setEmergencyAvailable(data.emergencyAvailable);
      setUnavailablePeriods(data.unavailablePeriods || []);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      // Use default schedule if fetch fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayToggle = (dayValue: DayOfWeek) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.day === dayValue ? { ...day, enabled: !day.enabled } : day
      )
    );
  };

  const handleSlotChange = (
    dayValue: DayOfWeek,
    slotIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.day !== dayValue) return day;
        const newSlots = [...day.slots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
        return { ...day, slots: newSlots };
      })
    );
  };

  const handleAddSlot = (dayValue: DayOfWeek) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.day !== dayValue) return day;
        return {
          ...day,
          slots: [...day.slots, { start: '09:00', end: '17:00' }],
        };
      })
    );
  };

  const handleRemoveSlot = (dayValue: DayOfWeek, slotIndex: number) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.day !== dayValue) return day;
        if (day.slots.length <= 1) return day; // Keep at least one slot
        return {
          ...day,
          slots: day.slots.filter((_, idx) => idx !== slotIndex),
        };
      })
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      await proApi.updateAvailability({
        schedule,
        emergencyAvailable,
        unavailablePeriods,
      });
      setSuccess('Availability updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUnavailablePeriod = async () => {
    if (!newUnavailable.startDate || !newUnavailable.endDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      const result = await proApi.setUnavailable(newUnavailable);
      setUnavailablePeriods((prev) => [...prev, result]);
      setShowAddUnavailable(false);
      setNewUnavailable({ startDate: '', endDate: '', reason: '' });
      setSuccess('Unavailable period added');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add unavailable period');
    }
  };

  const handleRemoveUnavailablePeriod = async (id: string) => {
    try {
      await proApi.removeUnavailable(id);
      setUnavailablePeriods((prev) => prev.filter((p) => p.id !== id));
      setSuccess('Unavailable period removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove unavailable period');
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-primary-600">
              Trades Pro
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-medium">Availability</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 h-10 px-6 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Weekly Schedule */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Weekly Schedule</h2>
          <p className="text-sm text-gray-500 mb-6">
            Set your regular working hours for each day of the week.
          </p>

          <div className="space-y-4">
            {schedule.map((day) => {
              const dayInfo = DAYS_OF_WEEK.find((d) => d.value === day.day);
              return (
                <div
                  key={day.day}
                  className={`p-4 rounded-lg border ${
                    day.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={() => handleDayToggle(day.day)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className={`font-medium ${day.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {dayInfo?.label}
                      </span>
                    </label>

                    {day.enabled && (
                      <button
                        onClick={() => handleAddSlot(day.day)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Add time slot
                      </button>
                    )}
                  </div>

                  {day.enabled && (
                    <div className="space-y-2 ml-8">
                      {day.slots.map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) =>
                              handleSlotChange(day.day, slotIndex, 'start', e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) =>
                              handleSlotChange(day.day, slotIndex, 'end', e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {day.slots.length > 1 && (
                            <button
                              onClick={() => handleRemoveSlot(day.day, slotIndex)}
                              className="p-2 text-gray-400 hover:text-red-500"
                              title="Remove slot"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Availability */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Emergency Availability</h2>
              <p className="text-sm text-gray-500 mt-1">
                Accept emergency jobs outside of regular hours. You'll be notified for urgent requests.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyAvailable}
                onChange={(e) => setEmergencyAvailable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>

        {/* Unavailable Periods */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Time Off & Vacations</h2>
              <p className="text-sm text-gray-500 mt-1">
                Block specific dates when you're not available.
              </p>
            </div>
            <button
              onClick={() => setShowAddUnavailable(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 h-9 px-4"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Time Off
            </button>
          </div>

          {unavailablePeriods.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No time off scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unavailablePeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(period.startDate).toLocaleDateString('en-CA', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {period.startDate !== period.endDate && (
                        <>
                          {' - '}
                          {new Date(period.endDate).toLocaleDateString('en-CA', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </div>
                    {period.reason && (
                      <p className="text-sm text-gray-500">{period.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => period.id && handleRemoveUnavailablePeriod(period.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    title="Remove"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800">Availability Tips</h4>
              <ul className="mt-1 text-sm text-blue-700 space-y-1">
                <li>Jobs will only be dispatched during your available hours</li>
                <li>Enable emergency availability to get more job opportunities</li>
                <li>Add time off in advance to avoid dispatch conflicts</li>
                <li>Multiple time slots per day allow for breaks</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Add Unavailable Modal */}
      {showAddUnavailable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Time Off</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={newUnavailable.startDate}
                  onChange={(e) =>
                    setNewUnavailable((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={newUnavailable.endDate}
                  onChange={(e) =>
                    setNewUnavailable((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  min={newUnavailable.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={newUnavailable.reason}
                  onChange={(e) =>
                    setNewUnavailable((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g., Vacation, Personal day"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUnavailable(false);
                  setNewUnavailable({ startDate: '', endDate: '', reason: '' });
                }}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUnavailablePeriod}
                disabled={!newUnavailable.startDate || !newUnavailable.endDate}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Add Time Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
