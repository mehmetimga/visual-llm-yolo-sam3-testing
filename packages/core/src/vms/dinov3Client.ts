/**
 * DINOv3 Client
 * Visual embedding service for similarity search
 */

export interface DINOv3Config {
  url: string;
  timeout?: number;
}

export interface DINOv3Client {
  computeEmbedding(imagePath: string): Promise<number[]>;
}

export async function createDINOv3Client(config: DINOv3Config): Promise<DINOv3Client> {
  const timeout = config.timeout || 30000;

  return {
    async computeEmbedding(imagePath: string): Promise<number[]> {
      try {
        const response = await fetch(`${config.url}/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_path: imagePath }),
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`DINOv3 service returned ${response.status}`);
        }

        const data = await response.json() as { embedding: number[] };
        return data.embedding || [];
      } catch (err) {
        console.error('DINOv3 service error:', err);
        return [];
      }
    },
  };
}

/**
 * Mock DINOv3 client for development/testing
 * Returns a random 768-dimensional embedding
 */
export function createMockDINOv3Client(): DINOv3Client {
  return {
    async computeEmbedding(_imagePath: string): Promise<number[]> {
      // Generate a deterministic-ish embedding based on image path
      const embedding: number[] = [];
      for (let i = 0; i < 768; i++) {
        embedding.push(Math.random() * 2 - 1);
      }
      return embedding;
    },
  };
}

