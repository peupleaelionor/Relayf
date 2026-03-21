type QueryParams = Record<string, string | number | boolean | undefined | null>;

import type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
  Contact,
  ContactTag,
  Campaign,
  CampaignRecipient,
  Template,
  Message,
  Workspace,
  WorkspaceMember,
  APIKeyWithSecret,
  WebhookEndpoint,
  SenderIdentity,
  AuthTokens,
  PublicUser,
} from "@relayflow/types";

// ─────────────────────────────────────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────────────────────────────────────

export class RelayFlowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RelayFlowError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface RelayFlowClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client
// ─────────────────────────────────────────────────────────────────────────────

class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private headers: Record<string, string>;

  constructor(options: Required<Omit<RelayFlowClientOptions, "apiKey">> & { apiKey?: string }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeout = options.timeout;
    this.retries = options.retries;
    this.retryDelay = options.retryDelay;
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "relayflow-sdk/0.1.0",
      ...options.headers,
    };
    if (options.apiKey) {
      this.headers["Authorization"] = `Bearer ${options.apiKey}`;
    }
  }

  setAuthToken(token: string): void {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.headers["Authorization"];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = (await response.json()) as ApiResponse<T>;

        if (!response.ok || !data.success) {
          const err = data as ApiErrorResponse;
          throw new RelayFlowError(
            err.error.code,
            err.error.message,
            response.status,
            err.error.details,
          );
        }

        return (data as { success: true; data: T }).data;
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof RelayFlowError) {
          // Don't retry client errors (4xx)
          if (err.statusCode && err.statusCode < 500) throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.retries) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource clients
// ─────────────────────────────────────────────────────────────────────────────

export class AuthResource {
  constructor(private http: HttpClient) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    return this.http.post<AuthTokens>("/auth/login", { email, password });
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    workspaceName?: string;
  }): Promise<AuthTokens> {
    return this.http.post<AuthTokens>("/auth/register", data);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.http.post<AuthTokens>("/auth/refresh", { refreshToken });
  }

  async logout(refreshToken: string): Promise<void> {
    return this.http.post<void>("/auth/logout", { refreshToken });
  }

  async me(): Promise<PublicUser> {
    return this.http.get<PublicUser>("/auth/me");
  }

  async forgotPassword(email: string): Promise<void> {
    return this.http.post<void>("/auth/forgot-password", { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    return this.http.post<void>("/auth/reset-password", { token, password });
  }
}

export interface ListContactsParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  tagId?: string;
}

export class ContactsResource {
  constructor(private http: HttpClient) {}

  list(params?: ListContactsParams): Promise<PaginatedResponse<Contact>> {
    return this.http.get<PaginatedResponse<Contact>>("/contacts", params as QueryParams);
  }

  get(id: string): Promise<Contact> {
    return this.http.get<Contact>(`/contacts/${id}`);
  }

  create(data: {
    email?: string;
    phone?: string;
    telegramId?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
    attributes?: Record<string, unknown>;
    tagIds?: string[];
  }): Promise<Contact> {
    return this.http.post<Contact>("/contacts", data);
  }

  update(id: string, data: Partial<{
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    attributes: Record<string, unknown>;
    tagIds: string[];
  }>): Promise<Contact> {
    return this.http.patch<Contact>(`/contacts/${id}`, data);
  }

  delete(id: string): Promise<void> {
    return this.http.delete<void>(`/contacts/${id}`);
  }

  bulkUpsert(data: {
    contacts: Array<{
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      attributes?: Record<string, unknown>;
    }>;
    updateExisting?: boolean;
    matchField?: "email" | "phone" | "externalId";
  }): Promise<{ created: number; updated: number; skipped: number }> {
    return this.http.post("/contacts/bulk", data);
  }

  tags = {
    list: (): Promise<ContactTag[]> =>
      this.http.get<ContactTag[]>("/contacts/tags"),
    create: (data: { name: string; color?: string }): Promise<ContactTag> =>
      this.http.post<ContactTag>("/contacts/tags", data),
    delete: (id: string): Promise<void> =>
      this.http.delete<void>(`/contacts/tags/${id}`),
  };
}

export interface ListCampaignsParams {
  page?: number;
  perPage?: number;
  status?: string;
  channel?: string;
}

export class CampaignsResource {
  constructor(private http: HttpClient) {}

  list(params?: ListCampaignsParams): Promise<PaginatedResponse<Campaign>> {
    return this.http.get<PaginatedResponse<Campaign>>("/campaigns", params as QueryParams);
  }

  get(id: string): Promise<Campaign> {
    return this.http.get<Campaign>(`/campaigns/${id}`);
  }

  create(data: {
    name: string;
    channel: string;
    templateId?: string;
    subject?: string;
    body?: string;
    senderIdentityId?: string;
    scheduledAt?: string;
    throttleRpm?: number;
    recipientTagIds?: string[];
    recipientContactIds?: string[];
  }): Promise<Campaign> {
    return this.http.post<Campaign>("/campaigns", data);
  }

  update(id: string, data: Partial<{
    name: string;
    subject: string;
    body: string;
    scheduledAt: string;
    throttleRpm: number;
  }>): Promise<Campaign> {
    return this.http.patch<Campaign>(`/campaigns/${id}`, data);
  }

  launch(id: string): Promise<Campaign> {
    return this.http.post<Campaign>(`/campaigns/${id}/launch`, {});
  }

  pause(id: string): Promise<Campaign> {
    return this.http.post<Campaign>(`/campaigns/${id}/pause`, {});
  }

  cancel(id: string): Promise<Campaign> {
    return this.http.post<Campaign>(`/campaigns/${id}/cancel`, {});
  }

  getRecipients(
    id: string,
    params?: { page?: number; perPage?: number; status?: string },
  ): Promise<PaginatedResponse<CampaignRecipient>> {
    return this.http.get<PaginatedResponse<CampaignRecipient>>(
      `/campaigns/${id}/recipients`,
      params as QueryParams,
    );
  }
}

export class TemplatesResource {
  constructor(private http: HttpClient) {}

  list(params?: { page?: number; perPage?: number; channel?: string }): Promise<PaginatedResponse<Template>> {
    return this.http.get<PaginatedResponse<Template>>("/templates", params as QueryParams);
  }

  get(id: string): Promise<Template> {
    return this.http.get<Template>(`/templates/${id}`);
  }

  create(data: {
    name: string;
    channel: string;
    subject?: string;
    body: string;
    previewText?: string;
  }): Promise<Template> {
    return this.http.post<Template>("/templates", data);
  }

  update(id: string, data: Partial<{
    name: string;
    subject: string;
    body: string;
    previewText: string;
  }>): Promise<Template> {
    return this.http.patch<Template>(`/templates/${id}`, data);
  }

  delete(id: string): Promise<void> {
    return this.http.delete<void>(`/templates/${id}`);
  }
}

export class MessagesResource {
  constructor(private http: HttpClient) {}

  send(data: {
    channel: string;
    to: string;
    subject?: string;
    body: string;
    contactId?: string;
    senderIdentityId?: string;
  }): Promise<Message> {
    return this.http.post<Message>("/messages", data);
  }

  list(params?: {
    page?: number;
    perPage?: number;
    campaignId?: string;
    contactId?: string;
    channel?: string;
    status?: string;
  }): Promise<PaginatedResponse<Message>> {
    return this.http.get<PaginatedResponse<Message>>("/messages", params as QueryParams);
  }

  get(id: string): Promise<Message> {
    return this.http.get<Message>(`/messages/${id}`);
  }
}

export class WorkspaceResource {
  constructor(private http: HttpClient) {}

  get(): Promise<Workspace> {
    return this.http.get<Workspace>("/workspace");
  }

  update(data: Partial<{ name: string; timezone: string; locale: string }>): Promise<Workspace> {
    return this.http.patch<Workspace>("/workspace", data);
  }

  members = {
    list: (): Promise<WorkspaceMember[]> =>
      this.http.get<WorkspaceMember[]>("/workspace/members"),
    invite: (email: string, role?: string): Promise<void> =>
      this.http.post<void>("/workspace/members/invite", { email, role }),
    remove: (userId: string): Promise<void> =>
      this.http.delete<void>(`/workspace/members/${userId}`),
    updateRole: (userId: string, role: string): Promise<WorkspaceMember> =>
      this.http.patch<WorkspaceMember>(`/workspace/members/${userId}`, { role }),
  };

  apiKeys = {
    list: (): Promise<Omit<APIKeyWithSecret, "secret">[]> =>
      this.http.get("/workspace/api-keys"),
    create: (data: { name: string; scopes: string[]; expiresAt?: string }): Promise<APIKeyWithSecret> =>
      this.http.post<APIKeyWithSecret>("/workspace/api-keys", data),
    revoke: (id: string): Promise<void> =>
      this.http.delete<void>(`/workspace/api-keys/${id}`),
  };
}

export class WebhooksResource {
  constructor(private http: HttpClient) {}

  list(): Promise<WebhookEndpoint[]> {
    return this.http.get<WebhookEndpoint[]>("/webhooks");
  }

  get(id: string): Promise<WebhookEndpoint> {
    return this.http.get<WebhookEndpoint>(`/webhooks/${id}`);
  }

  create(data: {
    url: string;
    events: string[];
    description?: string;
    isActive?: boolean;
  }): Promise<WebhookEndpoint> {
    return this.http.post<WebhookEndpoint>("/webhooks", data);
  }

  update(id: string, data: Partial<{
    url: string;
    events: string[];
    description: string;
    isActive: boolean;
  }>): Promise<WebhookEndpoint> {
    return this.http.patch<WebhookEndpoint>(`/webhooks/${id}`, data);
  }

  delete(id: string): Promise<void> {
    return this.http.delete<void>(`/webhooks/${id}`);
  }

  ping(id: string): Promise<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`/webhooks/${id}/ping`, {});
  }
}

export class SenderIdentitiesResource {
  constructor(private http: HttpClient) {}

  list(): Promise<SenderIdentity[]> {
    return this.http.get<SenderIdentity[]>("/sender-identities");
  }

  create(data: {
    type: string;
    name: string;
    value: string;
    isDefault?: boolean;
  }): Promise<SenderIdentity> {
    return this.http.post<SenderIdentity>("/sender-identities", data);
  }

  delete(id: string): Promise<void> {
    return this.http.delete<void>(`/sender-identities/${id}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SDK client
// ─────────────────────────────────────────────────────────────────────────────

export class RelayFlowClient {
  private http: HttpClient;

  readonly auth: AuthResource;
  readonly contacts: ContactsResource;
  readonly campaigns: CampaignsResource;
  readonly templates: TemplatesResource;
  readonly messages: MessagesResource;
  readonly workspace: WorkspaceResource;
  readonly webhooks: WebhooksResource;
  readonly senderIdentities: SenderIdentitiesResource;

  constructor(options: RelayFlowClientOptions = {}) {
    const resolved: Required<Omit<RelayFlowClientOptions, "apiKey">> & { apiKey?: string } = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? "https://api.relayflow.io/v1",
      timeout: options.timeout ?? 30_000,
      retries: options.retries ?? 2,
      retryDelay: options.retryDelay ?? 500,
      headers: options.headers ?? {},
    };

    this.http = new HttpClient(resolved);
    this.auth = new AuthResource(this.http);
    this.contacts = new ContactsResource(this.http);
    this.campaigns = new CampaignsResource(this.http);
    this.templates = new TemplatesResource(this.http);
    this.messages = new MessagesResource(this.http);
    this.workspace = new WorkspaceResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.senderIdentities = new SenderIdentitiesResource(this.http);
  }

  /** Set a Bearer token for subsequent requests (used after login). */
  setToken(token: string): void {
    this.http.setAuthToken(token);
  }

  /** Clear the auth token. */
  clearToken(): void {
    this.http.clearAuthToken();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience factory
// ─────────────────────────────────────────────────────────────────────────────

export function createRelayFlowClient(options: RelayFlowClientOptions = {}): RelayFlowClient {
  return new RelayFlowClient(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type {
  Contact,
  Campaign,
  Template,
  Message,
  Workspace,
  AuthTokens,
  PaginatedResponse,
} from "@relayflow/types";
