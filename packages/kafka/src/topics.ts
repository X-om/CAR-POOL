import type { Kafka } from 'kafkajs';

export type KafkaTopicSpec = {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
  configEntries?: { name: string; value: string }[];
};

export async function ensureTopics(kafka: Kafka, topics: KafkaTopicSpec[]): Promise<void> {
  if (topics.length === 0) return;

  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((t) => ({
        topic: t.topic,
        numPartitions: t.numPartitions ?? 1,
        replicationFactor: t.replicationFactor ?? 1,
        configEntries: t.configEntries,
      })),
    });
  } finally {
    await admin.disconnect();
  }
}
