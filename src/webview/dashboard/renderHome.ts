export interface DashboardHomeStats {
  totalTasks: number;
  completedTasks: number;
}

export function renderHome(stats: DashboardHomeStats): string {
  return `
    <section class="home-card">
      <h1>Educoder Local OJ</h1>
      <p>任务总数：${stats.totalTasks}</p>
      <p>已通关：${stats.completedTasks}</p>
    </section>
  `;
}
