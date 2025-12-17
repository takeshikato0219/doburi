import { createTRPCRouter } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { attendanceRouter } from "./routers/attendance";
import { workRecordsRouter } from "./routers/workRecords";
import { vehiclesRouter } from "./routers/vehicles";
import { processesRouter } from "./routers/processes";
import { vehicleTypesRouter } from "./routers/vehicleTypes";
import { usersRouter } from "./routers/users";
import { analyticsRouter } from "./routers/analytics";
import { csvRouter } from "./routers/csv";
import { checksRouter } from "./routers/checks";
import { salesBroadcastsRouter } from "./routers/salesBroadcasts";
import { bulletinRouter } from "./routers/bulletin";
import { breakTimesRouter } from "./routers/breakTimes";
import { staffScheduleRouter } from "./routers/staffSchedule";
import { backupRouter } from "./routers/backup";
import { deliverySchedulesRouter } from "./routers/deliverySchedules";
import { notificationsRouter } from "./routers/notifications";

export const appRouter = createTRPCRouter({
    auth: authRouter,
    attendance: attendanceRouter,
    workRecords: workRecordsRouter,
    vehicles: vehiclesRouter,
    processes: processesRouter,
    vehicleTypes: vehicleTypesRouter,
    users: usersRouter,
    analytics: analyticsRouter,
    csv: csvRouter,
    checks: checksRouter,
    salesBroadcasts: salesBroadcastsRouter,
    bulletin: bulletinRouter,
    breakTimes: breakTimesRouter,
    staffSchedule: staffScheduleRouter,
    backup: backupRouter,
    deliverySchedules: deliverySchedulesRouter,
    notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;

