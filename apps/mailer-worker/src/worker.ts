import nodemailer from "nodemailer";
import {
  createKafkaClient,
  createAndConnectConsumer,
  createAndConnectProducer,
  ensureTopics,
  subscribeAndRunConsumer,
} from "@repo/kafka";
import { EMAIL_JOBS_DLQ_TOPIC, EMAIL_JOBS_TOPIC, EmailJobSchema, renderEmail } from "@repo/mailer";
import {
  KAFKA_BROKERS,
  MAILER_KAFKA_GROUP_ID,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from "./env";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

async function main(): Promise<void> {
  const kafka = createKafkaClient({ clientId: "mailer-worker", brokers: KAFKA_BROKERS.split(",").map((b) => b.trim()) });
  await ensureTopics(kafka, [{ topic: EMAIL_JOBS_TOPIC }, { topic: EMAIL_JOBS_DLQ_TOPIC }]);
  const consumer = await createAndConnectConsumer({ kafka, groupId: MAILER_KAFKA_GROUP_ID });
  const producer = await createAndConnectProducer({ kafka });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[mailer-worker] shutting down (${signal})`);
    await consumer.disconnect().catch(() => undefined);
    await producer.disconnect().catch(() => undefined);
    transporter.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await subscribeAndRunConsumer({
    consumer,
    topic: EMAIL_JOBS_TOPIC,
    fromBeginning: false,
    runConfig: {
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        const raw = message.value.toString("utf8");
        const parsed = EmailJobSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error("Invalid email job payload", parsed.error.flatten().fieldErrors);
          return;
        }

        const job = parsed.data;

        const maxAttempts = job.maxAttempts ?? 3;
        const baseAttempt = job.attempt ?? 0;

        let lastErr: unknown = null;
        for (let attempt = baseAttempt; attempt < maxAttempts; attempt++) {
          try {
            const rendered = await renderEmail({
              // renderEmail is strongly typed by templateId at compile time,
              // but jobs are runtime data; we validate templateId with zod.
              templateId: job.templateId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              templateVariables: job.templateVariables as any,
            });

            await transporter.sendMail({
              from: job.from,
              to: job.to,
              subject: rendered.subject,
              text: rendered.text,
              html: rendered.html,
            });

            // eslint-disable-next-line no-console
            console.log(`[mailer-worker] sent email jobId=${job.jobId} template=${job.templateId} to=${job.to}`);
            return;
          } catch (err) {
            lastErr = err;
            const delay = attempt === 0 ? 250 : attempt === 1 ? 1000 : 4000;
            await sleep(delay);
          }
        }

        const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        // DLQ
        await producer.send({
          topic: EMAIL_JOBS_DLQ_TOPIC,
          messages: [
            {
              key: job.jobId,
              value: JSON.stringify({
                ...job,
                attempt: maxAttempts,
                maxAttempts,
                lastError: errMsg,
              }),
              headers: {
                reason: 'SMTP_SEND_FAILED',
              },
            },
          ],
        });

        // eslint-disable-next-line no-console
        console.error(`[mailer-worker] job sent to DLQ jobId=${job.jobId} err=${errMsg}`);
      },
    },
  });
}

void main();
