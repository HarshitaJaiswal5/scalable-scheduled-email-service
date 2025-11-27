import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.REMINDER_QUEUE_URL;

type ReminderEvent = {
  reminderId: number;
  email: string;
};

export const handler = async (event: ReminderEvent) => {
  console.log("Received reminder event:", event);

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        reminderId: event.reminderId,
        email: event.email,
      }),
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};
