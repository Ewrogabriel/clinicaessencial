// ============================================================
// WhatsApp Business Integration – Cron Scheduler
//
// Manages the lifecycle of all WhatsApp automation cron jobs.
//
// Schedules:
//   - Session confirmation : every hour        (0 * * * *)
//   - Monthly reminder     : daily at midnight  (0 0 * * *)
//   - Overdue alert        : every 2 hours      (0 */2 * * *)
//
// Usage:
//   import { cronScheduler } from "@/lib/whatsapp/cronScheduler";
//   cronScheduler.scheduleCrons();   // start all jobs
//   cronScheduler.stopCrons();       // stop all jobs
//
// NOTE: In a browser environment, native `setInterval`-based
// timers are used as a fallback because the `node-cron` package
// requires a Node.js runtime.  When running inside a Node.js
// process (e.g., a dedicated worker or Next.js server component)
// you can swap the timer approach for a proper cron library.
// ============================================================

import { runSessionConfirmationCron } from "@/modules/whatsapp/cron/sessionConfirmationCron";
import { runMonthlyReminderCron } from "@/modules/whatsapp/cron/monthlyReminderCron";
import { runOverdueAlertCron } from "@/modules/whatsapp/cron/overdueAlertCron";

// ── Types ────────────────────────────────────────────────────

export interface CronJob {
  name: string;
  /** Cron expression (informational only when using interval fallback). */
  schedule: string;
  /** Interval in milliseconds. */
  intervalMs: number;
  handler: () => Promise<number>;
}

export interface CronExecutionLog {
  jobName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  count: number;
  error: string | null;
}

// ── CronScheduler ─────────────────────────────────────────────

export class CronScheduler {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private executionLogs: CronExecutionLog[] = [];

  private readonly jobs: CronJob[] = [
    {
      name: "session_confirmation",
      schedule: "0 * * * *",     // every hour
      intervalMs: 60 * 60 * 1000,
      handler: runSessionConfirmationCron,
    },
    {
      name: "monthly_reminder",
      schedule: "0 0 * * *",     // daily at midnight
      intervalMs: 24 * 60 * 60 * 1000,
      handler: runMonthlyReminderCron,
    },
    {
      name: "overdue_alert",
      schedule: "0 */2 * * *",   // every 2 hours
      intervalMs: 2 * 60 * 60 * 1000,
      handler: runOverdueAlertCron,
    },
  ];

  // ── Public API ─────────────────────────────────────────────

  /**
   * Starts all cron jobs.
   * Calling this when jobs are already running is a no-op (they are
   * stopped first to avoid duplicates).
   */
  scheduleCrons(): void {
    this.stopCrons();

    for (const job of this.jobs) {
      const timer = setInterval(() => {
        this.runJob(job).catch((err) => {
          console.error(`[CronScheduler] Erro inesperado no job "${job.name}":`, err);
        });
      }, job.intervalMs);

      this.timers.set(job.name, timer);
      console.info(
        `[CronScheduler] Job "${job.name}" agendado (schedule: ${job.schedule}, ` +
        `intervalo: ${job.intervalMs / 1000}s).`
      );
    }

    console.info(`[CronScheduler] ${this.jobs.length} job(s) em execução.`);
  }

  /**
   * Stops all running cron jobs and clears internal timers.
   */
  stopCrons(): void {
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      console.info(`[CronScheduler] Job "${name}" parado.`);
    }
    this.timers.clear();
  }

  /**
   * Returns whether any jobs are currently scheduled.
   */
  isRunning(): boolean {
    return this.timers.size > 0;
  }

  /**
   * Returns a copy of the execution log history (most recent last).
   */
  getExecutionLogs(): CronExecutionLog[] {
    return [...this.executionLogs];
  }

  /**
   * Manually triggers a job by name outside of its normal schedule.
   * Useful for testing or on-demand execution.
   *
   * Returns the execution log entry for the run.
   */
  async triggerJob(jobName: string): Promise<CronExecutionLog | null> {
    const job = this.jobs.find((j) => j.name === jobName);
    if (!job) {
      console.warn(`[CronScheduler] Job desconhecido: "${jobName}".`);
      return null;
    }
    return this.runJob(job);
  }

  // ── Private helpers ────────────────────────────────────────

  private async runJob(job: CronJob): Promise<CronExecutionLog> {
    const startedAt = new Date().toISOString();
    const start = Date.now();

    console.info(`[CronScheduler] Iniciando job "${job.name}"…`);

    let count = 0;
    let error: string | null = null;

    try {
      count = await job.handler();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error(`[CronScheduler] Job "${job.name}" falhou:`, error);
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - start;

    const logEntry: CronExecutionLog = {
      jobName: job.name,
      startedAt,
      finishedAt,
      durationMs,
      count,
      error,
    };

    this.executionLogs.push(logEntry);

    // Keep only the last 1000 log entries to avoid unbounded memory growth
    if (this.executionLogs.length > 1000) {
      this.executionLogs.splice(0, this.executionLogs.length - 1000);
    }

    console.info(
      `[CronScheduler] Job "${job.name}" concluído em ${durationMs}ms ` +
      `(count=${count}${error ? `, error=${error}` : ""}).`
    );

    return logEntry;
  }
}

/** Singleton instance exported for application-wide use. */
export const cronScheduler = new CronScheduler();
