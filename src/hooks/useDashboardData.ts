import { useEffect, useMemo, useState, useCallback } from "react";
import type { SidebarProject, DashboardMetrics, Project, TimeLog } from "../types/dashboard";
import { calculateDashboardMetrics, fetchProjects, fetchTimeLogs } from "../services/dashboard";

let inFlightDashboardLoad: Promise<void> | null = null;

export function useDashboardData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (inFlightDashboardLoad) return inFlightDashboardLoad;

    setLoading(true);
    setError(null);
    inFlightDashboardLoad = (async () => {
      try {
        const [ps, tls] = await Promise.all([fetchProjects(), fetchTimeLogs()]);
        setProjects(ps);
        setTimeLogs(tls);
        setMetrics(calculateDashboardMetrics(ps, tls) as DashboardMetrics);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
        inFlightDashboardLoad = null;
      }
    })();

    return inFlightDashboardLoad;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sidebarProjects: SidebarProject[] = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const map = new Map<string, number>();
    for (const t of timeLogs) {
      map.set(t.project_id, (map.get(t.project_id) || 0) + Number(t.hours || 0));
    }
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      trackedHours: Number((map.get(p.id) || 0).toFixed(2)),
    }));
  }, [projects, timeLogs]);

  return {
    projects: sidebarProjects,
    rawProjects: projects,
    timeLogs,
    metrics,
    loading,
    error,
    refresh: load,
  };
}
