import { supabase } from "../integrations/supabase";
import type { Project, TimeLog } from "../types/dashboard";

export function calculateDashboardMetrics(projects: Project[], timeLogs: TimeLog[]) {
  const totalHours = timeLogs.reduce((sum, timeLog) => sum + Number(timeLog.hours || 0), 0);

  const projectRate = new Map<string, number>();
  for (const project of projects) projectRate.set(project.id, Number(project.hourly_rate || 0));

  const estimatedEarnings = timeLogs.reduce(
    (sum, timeLog) => sum + Number(timeLog.hours || 0) * (projectRate.get(timeLog.project_id) || 0),
    0,
  );

  return {
    totalHours,
    estimatedEarnings,
    activeProjects: projects.length,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,client,hourly_rate,created_at");
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function fetchTimeLogs(): Promise<TimeLog[]> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("id,project_id,hours,description,logged_at");
  if (error) throw error;
  return (data ?? []) as TimeLog[];
}

export async function fetchDashboardMetrics(): Promise<{
  totalHours: number;
  estimatedEarnings: number;
  activeProjects: number;
}> {
  const joinedMetrics = await supabase
    .from("time_logs")
    .select("hours,project:projects(hourly_rate)");

  if (!joinedMetrics.error && joinedMetrics.data) {
    const rows = joinedMetrics.data as Array<{
      hours: number;
      project?: { hourly_rate?: number | null } | null;
    }>;

    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
    const estimatedEarnings = rows.reduce(
      (sum, row) => sum + Number(row.hours || 0) * Number(row.project?.hourly_rate || 0),
      0,
    );

    const { data: projects } = await supabase.from("projects").select("id");

    return {
      totalHours,
      estimatedEarnings,
      activeProjects: projects?.length ?? 0,
    };
  }

  const [projects, timeLogs] = await Promise.all([fetchProjects(), fetchTimeLogs()]);

  return calculateDashboardMetrics(projects, timeLogs);
}
