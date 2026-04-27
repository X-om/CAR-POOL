export type OutboxRow = {
  id: string;
  kafkaTopic: string;
  kafkaKey: string;
  payload: unknown;
};

export type OutboxPublisherOptions = {
  schema: string;
  batchSize?: number;
};
