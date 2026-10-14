export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Endpoint {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  expected_status: number;
  check_interval_seconds: number;
  timeout_ms: number;
  retries: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthCheck {
  id: string;
  endpoint_id: string;
  status: "up" | "down" | "degraded";
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export interface Incident {
  id: string;
  endpoint_id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  started_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  status: string;
  message: string;
  created_at: string;
}

export interface AlertConfig {
  id: string;
  endpoint_id: string;
  type: "email" | "webhook";
  target: string;
  is_active: boolean;
  created_at: string;
}

export interface StatusPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

export interface EndpointWithStatus extends Endpoint {
  current_status: "up" | "down" | "degraded" | "unknown";
  uptime_24h: number;
  avg_response_time: number;
  last_checked: string | null;
}