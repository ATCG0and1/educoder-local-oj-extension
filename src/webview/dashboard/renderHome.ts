export interface DashboardHomeStats {
  totalTasks: number;
  completedTasks: number;
}

export function renderHome(stats: DashboardHomeStats): string {
  return `
    <section class="home-card">
      <div class="eyebrow">做题工作台</div>
      <h1>Educoder Local OJ</h1>
      <p>粘贴章节 URL 后点击“一键同步本章”，自动拉齐本章题目包并进入 VS Code 原生做题流。</p>
      <div class="pill-row">
        <span class="pill">任务总数：${stats.totalTasks}</span>
        <span class="pill">已通关：${stats.completedTasks}</span>
      </div>
    </section>
  `;
}
