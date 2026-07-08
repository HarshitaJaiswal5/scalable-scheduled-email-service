import {
  SchedulerClient,
  CreateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import type { schedule } from "../db/prisma/generated/prisma/client/client.js";

const schedulerClient = new SchedulerClient({
  region: process.env.AWS_REGION_NAME,
});

export async function scheduleReminderLambda(schedule: schedule) {
  if (!process.env.REMINDER_LAMBDA_ARN || !process.env.SCHEDULER_ROLE_ARN) {
    console.warn("Scheduler env vars not set, skipping Lambda schedule");
    return;
  }

  const date = new Date(schedule.reminderTime);
  if (isNaN(date.getTime())) {
    console.error("Invalid reminderTime:", schedule.reminderTime);
    throw new Error("Invalid reminderTime");
  }

  // get hour and minute in Asia/Kolkata
  const options = { timeZone: "Asia/Kolkata", hour12: false } as const;
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...options,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hourPart = parts.find((p) => p.type === "hour")?.value;
  const minutePart = parts.find((p) => p.type === "minute")?.value;

  if (!hourPart || !minutePart) {
    console.error("Could not extract hour/minute from date:", date);
    throw new Error("Invalid time conversion");
  }

  const hour = String(Number(hourPart)); // remove any leading zeros
  const minute = String(Number(minutePart));

  // build cron for daily at that hour:minute in Asia/Kolkata
  const cronExpr = `cron(${minute} ${hour} * * ? *)`;

  console.log("User time (raw):", schedule.reminderTime);
  console.log("Daily cron expression:", cronExpr, "Timezone=Asia/Kolkata");

  const scheduleName = `reminder-${schedule.id}`;

  const command = new CreateScheduleCommand({
    Name: scheduleName,
    ScheduleExpression: cronExpr,
    ScheduleExpressionTimezone: "Asia/Kolkata",
    FlexibleTimeWindow: { Mode: "OFF" },
    Target: {
      Arn: process.env.REMINDER_LAMBDA_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({
        reminderId: schedule.id,
        email: schedule.email,
      }),
    },
  });

  try {
    console.log("🔍 Sending CreateScheduleCommand...");
    await schedulerClient.send(command);
    console.log("✅ Schedule created successfully (cron):", cronExpr);
  } catch (err: any) {
    console.error("Error creating reminder:", err);
    throw err;
  }
}
