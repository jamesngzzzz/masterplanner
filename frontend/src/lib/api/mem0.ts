export interface Mem0MemoryItem {
  id: string;
  memory: string;
  hash?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export const fetchMem0Memories = async (profileId: string): Promise<Mem0MemoryItem[]> => {
  const res = await fetch(`/api/mem0/memories?profile_id=${profileId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch memories");
  }
  const data = await res.json();
  // Mem0 returns { results: [...] } or a plain array
  return Array.isArray(data) ? data : (data.results || []);
};
