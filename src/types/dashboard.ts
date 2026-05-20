export interface Project {
  id: string;
  name: string;
  client: string;
  hourly_rate?: number | null;
  created_at?: string | null;
}

export interface TimeLog {
  id: string;
  project_id: string;
  hours: number;
  description?: string | null;
  logged_at?: string | null;
}

export interface DashboardMetrics {
  totalHours: number;
  estimatedEarnings: number;
  activeProjects: number;
}

export interface SidebarProject {
  id: string;
  name: string;
  trackedHours: number;
}
