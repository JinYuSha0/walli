import { Cron } from "croner";

const createCron = (cron: string, timeZone = "UTC") =>
  new Cron(cron, {
    paused: true,
    timezone: timeZone,
  });

export const parseCronSchedule = (cron: string) => {
  createCron(cron);
};

export const getNextCronScheduledAt = (cron: string, timeZone: string, afterTimestamp: number) => {
  const nextRun = createCron(cron, timeZone).nextRun(new Date(afterTimestamp));

  if (!nextRun) {
    throw new Error("Cron expression has no next execution time");
  }

  return nextRun.getTime();
};
