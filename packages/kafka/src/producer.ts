import type { Kafka, Producer } from "kafkajs";

export type KafkaProducerOptions = {
  kafka: Kafka;
};

export async function createAndConnectProducer(opts: KafkaProducerOptions): Promise<Producer> {
  const producer = opts.kafka.producer();
  await producer.connect();
  return producer;
}
