import { Kafka, logLevel, type KafkaConfig } from "kafkajs";

export type KafkaClientOptions = {
  clientId: string;
  brokers: string[];
  ssl?: KafkaConfig["ssl"];
  sasl?: KafkaConfig["sasl"];
  logLevel?: KafkaConfig["logLevel"];
};

export function createKafkaClient(opts: KafkaClientOptions): Kafka {
  return new Kafka({
    clientId: opts.clientId,
    brokers: opts.brokers,
    ssl: opts.ssl,
    sasl: opts.sasl,
    logLevel: opts.logLevel ?? logLevel.NOTHING,
  });
}
