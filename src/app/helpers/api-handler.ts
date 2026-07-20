import { Net, NetResponse } from "./net-responses";

export class CoreService {
  private BASE_URL = process.env.NEXT_PUBLIC_DATABASE_LINK || '';

  private fallback: Net = {
    success: false,
    message: 'An error occurred.',
    data: null
  };

  public setBaseUrl(url: string): void {
    this.BASE_URL = url;
  }

  // 1. Made token fetching robust against null values
  private getToken(): string | null {
    if (typeof window === "undefined") return null; // Prevents crashing during Next.js SSR
    const userSession = sessionStorage.getItem("userSession");
    if (!userSession) return null;
    try {
      const parsed = JSON.parse(userSession);
      return parsed?.token || null;
    } catch {
      return null;
    }
  }

  // 2. Helper to generate uniform headers for every request securely
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async send(endpoint: string, payload: Record<string, any>): Promise<NetResponse> {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(), // Automatically injects token if available
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return new NetResponse({
        success: data.success ?? res.ok,
        message: data.message || '',
        data: data.data ?? null
      });
    } catch (e: any) {
      console.error(e); // Better than alert() in production logs
    }
    return new NetResponse(this.fallback);
  }

  public async delete(endpoint: string, payload: Record<string, any>): Promise<NetResponse> {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(), // FIXED: Added Auth and Content-Type tracking headers
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return new NetResponse({
        success: data.success ?? res.ok,
        message: data.message || '',
        data: data.data ?? null
      });
    } catch (e: any) {
      console.error(e);
    }
    return new NetResponse(this.fallback);
  }

  public async get(endpoint: string): Promise<NetResponse> {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders() // FIXED: Added Auth tokens to secure GET endpoints
      });
      const data = await res.json();
      return new NetResponse({
        success: data.success ?? res.ok,
        message: data.message || '',
        data: data.data ?? null
      });
    } catch (e: any) {
      console.error(e);
    }
    return new NetResponse(this.fallback);
  }
}
