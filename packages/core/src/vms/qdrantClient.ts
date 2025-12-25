/**
 * Qdrant Client
 * Vector database for visual memory storage and retrieval
 */

import type { VisualEmbeddingRecord, LocatorVariant } from '../schema.js';

export interface QdrantConfig {
  url: string;
  collection: string;
  timeout?: number;
}

export interface QdrantClient {
  upsert(record: VisualEmbeddingRecord): Promise<void>;
  search(embedding: number[], topK?: number): Promise<Array<{
    id: string;
    score: number;
    metadata: VisualEmbeddingRecord['metadata'];
    locator?: LocatorVariant;
  }>>;
  ensureCollection(): Promise<void>;
}

export async function createQdrantClient(config: QdrantConfig): Promise<QdrantClient> {
  const timeout = config.timeout || 10000;

  return {
    async ensureCollection(): Promise<void> {
      try {
        // Check if collection exists
        const checkResponse = await fetch(
          `${config.url}/collections/${config.collection}`,
          { signal: AbortSignal.timeout(timeout) }
        );

        if (checkResponse.status === 404) {
          // Create collection
          await fetch(`${config.url}/collections/${config.collection}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vectors: {
                size: 768, // DINOv3 embedding dimension
                distance: 'Cosine',
              },
            }),
            signal: AbortSignal.timeout(timeout),
          });
        }
      } catch (err) {
        console.error('Failed to ensure Qdrant collection:', err);
      }
    },

    async upsert(record: VisualEmbeddingRecord): Promise<void> {
      try {
        await fetch(`${config.url}/collections/${config.collection}/points`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: [
              {
                id: record.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
                vector: record.embedding,
                payload: record.metadata,
              },
            ],
          }),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (err) {
        console.error('Failed to upsert to Qdrant:', err);
      }
    },

    async search(embedding: number[], topK = 5): Promise<Array<{
      id: string;
      score: number;
      metadata: VisualEmbeddingRecord['metadata'];
      locator?: LocatorVariant;
    }>> {
      try {
        const response = await fetch(
          `${config.url}/collections/${config.collection}/points/search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vector: embedding,
              limit: topK,
              with_payload: true,
            }),
            signal: AbortSignal.timeout(timeout),
          }
        );

        if (!response.ok) {
          return [];
        }

        const data = await response.json() as {
          result: Array<{
            id: string;
            score: number;
            payload: VisualEmbeddingRecord['metadata'] & { locator?: LocatorVariant };
          }>;
        };

        return data.result.map(r => ({
          id: String(r.id),
          score: r.score,
          metadata: r.payload,
          locator: r.payload.locator,
        }));
      } catch (err) {
        console.error('Failed to search Qdrant:', err);
        return [];
      }
    },
  };
}

/**
 * Mock Qdrant client for development/testing
 */
export function createMockQdrantClient(): QdrantClient {
  const storage: Map<string, VisualEmbeddingRecord> = new Map();

  return {
    async ensureCollection(): Promise<void> {
      // No-op for mock
    },

    async upsert(record: VisualEmbeddingRecord): Promise<void> {
      storage.set(record.id, record);
    },

    async search(_embedding: number[], topK = 5): Promise<Array<{
      id: string;
      score: number;
      metadata: VisualEmbeddingRecord['metadata'];
      locator?: LocatorVariant;
    }>> {
      // Return random subset of stored records
      const records = Array.from(storage.values()).slice(0, topK);
      return records.map(r => ({
        id: r.id,
        score: Math.random() * 0.5 + 0.5, // Random score 0.5-1.0
        metadata: r.metadata,
      }));
    },
  };
}

