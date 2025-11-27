// worker/index.ts
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, ChangeMessageVisibilityCommand, Message as SQSMessage } from "@aws-sdk/client-sqs";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import pLimit from "p-limit";
import pRetry from "p-retry";

type ReminderPayload = {
  reminderId: number;
  email: string;
  // add other fields if you send them (title, body, etc.)
};

const REGION = process.env.AWS_REGION!;
const QUEUE_URL = process.env.REMINDER_QUEUE_URL!;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL!; // Verified SES identity
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY) || 5;
const POLL_WAIT_SECONDS = Number(process.env.POLL_WAIT_SECONDS) || 20;
const MAX_MESSAGES = Number(process.env.MAX_MESSAGES) || 10;
const VISIBILITY_TIMEOUT = Number(process.env.VISIBILITY_TIMEOUT) || 120; // seconds

if (!REGION || !QUEUE_URL || !SOURCE_EMAIL) {
  console.error("Missing required env vars. Set AWS_REGION, REMINDER_QUEUE_URL, and SOURCE_EMAIL.");
  process.exit(1);
}

const sqs = new SQSClient({ region: REGION });
const ses = new SESClient({ region: REGION });
const limit = pLimit(MAX_CONCURRENCY);

async function pollLoop(): Promise<void> {
  while (true) {
    try {
      const resp = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: MAX_MESSAGES,
          WaitTimeSeconds: POLL_WAIT_SECONDS,
          VisibilityTimeout: VISIBILITY_TIMEOUT,
          MessageAttributeNames: ["All"],
        }),
      );

      const messages: SQSMessage[] = resp.Messages ?? [];
      if (messages.length === 0) continue;

      // Process messages in parallel but limited by MAX_CONCURRENCY
      await Promise.all(messages.map((m) => limit(() => handleMessage(m))));
    } catch (err) {
      console.error("Poll error", err);
      // small backoff on poll failure
      await sleep(1000);
    }
  }
}

async function handleMessage(msg: SQSMessage): Promise<void> {
  const receipt = msg.ReceiptHandle!;
  let payload: ReminderPayload;

  try {
    payload = JSON.parse(msg.Body ?? "");
  } catch (err) {
    console.error("Invalid JSON payload, deleting message to avoid poison message:", err);
    await deleteMessage(receipt);
    return;
  }

  // OPTIONAL: extend visibility while processing if you expect long sends
  // await changeVisibility(receipt, 300);

  try {
    // Retry transient SES errors up to 3 times with exponential backoff
    await pRetry(() => sendEmail(payload), { retries: 3, factor: 2, minTimeout: 500 });
    await deleteMessage(receipt);
  } catch (err) {
    console.error("Failed to process message:", err);
    // Do not delete so SQS can retry. After maxReceiveCount -> DLQ.
    // Optionally: change visibility to delay immediate re-delivery:
    // await changeVisibility(receipt, 60);
  }
}

async function sendEmail({ reminderId, email }: ReminderPayload): Promise<void> {
  const params = {
    Source: SOURCE_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Reminder #${reminderId}` },
      Body: { Text: { Data: `Hi — this is your reminder (id: ${reminderId}).` } },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

async function deleteMessage(receiptHandle: string): Promise<void> {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle }));
}

async function changeVisibility(receiptHandle: string, timeoutSeconds: number): Promise<void> {
  await sqs.send(new ChangeMessageVisibilityCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
    VisibilityTimeout: timeoutSeconds,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Start the poll loop
pollLoop().catch((err) => {
  console.error("Worker crashed", err);
  process.exit(1);
});
