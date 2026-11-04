export type Professional = { id: string; name: string; phone: string; document: string; role: string; specialty: string; dailyRate: number; notes: string; photoDataUrl?: string; active: boolean; createdAt: string; updatedAt: string };
export type WorkDay = { id: string; professionalId: string; workId: string; date: string; dailyRate: number; overtimeAmount: number; notes: string; createdAt: string; updatedAt: string };
export function workDayAmount(day: WorkDay) { return day.dailyRate + day.overtimeAmount; }
