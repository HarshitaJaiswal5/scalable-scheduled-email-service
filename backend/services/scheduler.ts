import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";
import type { schedule } from "../db/prisma/generated/prisma/client/client.js";

const schedulerClient = new SchedulerClient({
  region: process.env.AWS_REGION,
});

export async function scheduleReminderLambda(schedule: schedule) {
  if (!process.env.REMINDER_LAMBDA_ARN || !process.env.SCHEDULER_ROLE_ARN) {
    console.warn("Scheduler env vars not set, skipping Lambda schedule");
    return;
  }

  // use schedule, not reminder
  const scheduleName = `reminder-${schedule.id}`;

  // make sure this matches your Prisma field name: `reminder`
  const iso = schedule.reminderTime.toISOString().replace(/\.\d{3}Z$/, "Z");

  const command = new CreateScheduleCommand({
    Name: scheduleName,
    ScheduleExpression: `at(${iso})`,
    FlexibleTimeWindow: { Mode: "OFF" },
    Target: {
      Arn: process.env.REMINDER_LAMBDA_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({
        // this key name is up to you, but the value must come from schedule
        reminderId: schedule.id,
        email: schedule.email,
      }),
    },
  });

  await schedulerClient.send(command);
}