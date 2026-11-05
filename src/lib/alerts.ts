// Alertas operativas (Fase 7).
//
// Se envian a un webhook generico (Slack, Discord, Mattermost o cualquier
// endpoint que reciba JSON) y/o a Telegram, si estan configurados. Nunca
// lanzan: una alerta que falla no debe tumbar una corrida de adaptadores.

import { logger } from "./logger";

export type Alert = {
  title: string;
  message: string;
  sourceId?: string;
  level?: "info" | "warning" | "error";
};

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALERT_TIMEOUT_MS = 10_000;

export function alertsConfigured(): boolean {
  return Boolean(
    WEBHOOK_URL || (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID)
  );
}

export async function sendAlert(alert: Alert): Promise<void> {
  if (!alertsConfigured()) return;

  const text = `[NCA UNJBG] ${alert.title}\n${alert.message}`;
  const tasks: Promise<void>[] = [];

  if (WEBHOOK_URL) {
    tasks.push(
      postJson(WEBHOOK_URL, {
        text,
        ...alert,
      })
    );
  }

  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
    tasks.push(
      postJson(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }
      )
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.warn("alert.delivery.failed", {
        sourceId: alert.sourceId,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al enviar alerta`);
  }
}
