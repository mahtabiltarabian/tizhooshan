import { Injectable, Logger } from "@nestjs/common";
import { maskPhone } from "../common/phone";

/** Sends the sign-in code. Chosen by SMS_SENDER (default "dev"). */
export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}
export const SMS_SENDER = Symbol("SMS_SENDER");

/**
 * Development sender: nothing leaves the machine. Writes the code to the
 * log with the phone masked: "OTP for 0912***4567: 123456".
 */
@Injectable()
export class DevSmsSender implements SmsSender {
  private readonly log = new Logger("DevSms");
  async sendOtp(phone: string, code: string) {
    this.log.log(`OTP for ${maskPhone(phone)}: ${code}`);
  }
}

/**
 * ===================== STUB: REAL SMS PROVIDER =====================
 * Placeholder for an Iranian SMS provider (for example Kavenegar's "verify
 * lookup" API). NOT IMPLEMENTED and never used unless SMS_SENDER=kavenegar.
 * It needs a contract with the provider; the key comes from SMS_API_KEY and
 * the message template from SMS_TEMPLATE. Implement sendOtp() as one HTTPS
 * call to the provider; never log the full phone or the provider's reply.
 * ===================================================================
 */
export class KavenegarSmsSender implements SmsSender {
  private readonly apiKey = process.env.SMS_API_KEY ?? "";
  private readonly template = process.env.SMS_TEMPLATE ?? "";

  constructor() {
    if (!this.apiKey) throw new Error("SMS_SENDER=kavenegar needs SMS_API_KEY");
  }

  async sendOtp(_phone: string, _code: string): Promise<void> {
    void this.template;
    throw new Error("KavenegarSmsSender is a stub: implement it before using SMS_SENDER=kavenegar");
  }
}

export function smsSenderFromEnv(): SmsSender {
  const kind = process.env.SMS_SENDER ?? "dev";
  if (kind === "dev") {
    if (process.env.NODE_ENV === "production") new Logger("DevSms").warn("SMS_SENDER=dev in production: codes go to the log only");
    return new DevSmsSender();
  }
  if (kind === "kavenegar") return new KavenegarSmsSender();
  throw new Error(`Unknown SMS_SENDER "${kind}"`);
}
