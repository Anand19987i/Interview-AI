import type { Session, ApiResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let errorMessage: string;
    try {
      const parsed = JSON.parse(errorBody) as ApiResponse<unknown>;
      errorMessage = parsed.error || `Request failed with status ${res.status}`;
    } catch {
      errorMessage = errorBody || `Request failed with status ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Unknown API error');
  }
  return json.data;
}

export async function createSession(): Promise<Session> {
  return request<Session>('/api/v1/sessions', { method: 'POST' });
}

export async function getSession(id: string): Promise<Session> {
  return request<Session>(`/api/v1/sessions/${id}`);
}

export async function updateContext(
  id: string,
  resumeText: string,
  jobDescription: string,
): Promise<Session> {
  return request<Session>(`/api/v1/sessions/${id}/context`, {
    method: 'PUT',
    body: JSON.stringify({ resumeText, jobDescription }),
  });
}

export async function deleteSession(id: string): Promise<void> {
  const url = `${API_URL}/api/v1/sessions/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete session: ${res.status}`);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
