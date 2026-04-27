import type { Consumer, ConsumerRunConfig, Kafka } from "kafkajs";

export type KafkaConsumerOptions = {
  kafka: Kafka;
  groupId: string;
};

export async function createAndConnectConsumer(opts: KafkaConsumerOptions): Promise<Consumer> {
  const consumer = opts.kafka.consumer({ groupId: opts.groupId });
  await consumer.connect();
  return consumer;
}

export async function subscribeAndRunConsumer(input: {
  consumer: Consumer;
  topic: string;
  fromBeginning?: boolean;
  runConfig: ConsumerRunConfig;
}): Promise<void> {
  await input.consumer.subscribe({ topic: input.topic, fromBeginning: input.fromBeginning ?? false });
  await input.consumer.run(input.runConfig);
}
