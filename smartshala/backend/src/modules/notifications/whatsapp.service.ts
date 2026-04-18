import { env } from "../../config/env.js";

export type WhatsAppPayload = {
  to: string;
  message: string;
};

export interface WhatsAppProvider {
  send(payload: WhatsAppPayload): Promise<{ providerMessageId?: string }>;
}

export class WhatsAppCloudProvider implements WhatsAppProvider {
  async send(_payload: WhatsAppPayload) {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      return { providerMessageId: "dry-run" };
    }
    return { providerMessageId: "queued-provider-call" };
  }
}

