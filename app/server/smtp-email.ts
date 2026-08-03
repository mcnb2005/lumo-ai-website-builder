import { connect, type Socket } from "cloudflare:sockets";
import { getRuntimeEnv } from "../../db";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  username: string;
  password: string;
  authMethod: "login" | "plain";
  fromEmail: string;
  fromName: string;
  heloName: string;
};

export type SmtpEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function enabled(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function smtpConfig(): SmtpConfig | null {
  const env = getRuntimeEnv();
  const host = env.SMTP_HOST?.trim() || "";
  const port = Number(env.SMTP_PORT || 587);
  const fromEmail = env.SMTP_FROM_EMAIL?.trim() || "";
  const username = env.SMTP_USER?.trim() || "";
  const password = env.SMTP_PASSWORD || "";
  if (!host || !fromEmail || !Number.isInteger(port)) return null;
  if (port < 1 || port > 65535 || port === 25) {
    throw new Error("SMTP_PORT phải là cổng hợp lệ và không được dùng cổng 25.");
  }
  if (Boolean(username) !== Boolean(password)) {
    throw new Error("SMTP_USER và SMTP_PASSWORD phải được cấu hình cùng nhau.");
  }
  const secure = enabled(env.SMTP_SECURE, port === 465);
  return {
    host,
    port,
    secure,
    startTls: secure ? false : enabled(env.SMTP_STARTTLS, true),
    username,
    password,
    authMethod:
      env.SMTP_AUTH_METHOD?.trim().toLowerCase() === "plain"
        ? "plain"
        : "login",
    fromEmail,
    fromName: env.SMTP_FROM_NAME?.trim() || "Lumo",
    heloName: env.SMTP_HELO_NAME?.trim() || "lumo.local",
  };
}

export function getSmtpStatus() {
  const config = smtpConfig();
  return config
    ? {
        configured: true,
        host: config.host,
        port: config.port,
        secure: config.secure,
        startTls: config.startTls,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
      }
    : { configured: false };
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${toBase64(safeHeader(value))}?=`;
}

function messageSource(config: SmtpConfig, email: SmtpEmail) {
  const boundary = `lumo-${crypto.randomUUID()}`;
  const headers = [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${config.heloName}>`,
    `From: ${encodedHeader(config.fromName)} <${config.fromEmail}>`,
    `To: ${email.to}`,
    `Subject: ${encodedHeader(email.subject)}`,
    "MIME-Version: 1.0",
  ];
  const source = email.html
    ? [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        email.text,
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        email.html,
        `--${boundary}--`,
        "",
      ].join("\r\n")
    : [
        ...headers,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        email.text,
        "",
      ].join("\r\n");
  return source.replace(/\r?\n\./g, "\r\n..");
}

class SmtpSession {
  private socket: Socket;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  constructor(socket: Socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async opened() {
    await this.socket.opened;
  }

  async response() {
    const lines: string[] = [];
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline >= 0) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newline + 1);
        lines.push(line);
        const match = line.match(/^(\d{3})([ -])/);
        if (match?.[2] === " ") {
          return { code: Number(match[1]), text: lines.join("\n") };
        }
        continue;
      }
      const chunk = await this.reader.read();
      if (chunk.done) {
        throw new Error("SMTP đã đóng kết nối trước khi hoàn tất.");
      }
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
  }

  async command(command: string, expected: number[]) {
    await this.writer.write(this.encoder.encode(`${command}\r\n`));
    const response = await this.response();
    if (!expected.includes(response.code)) {
      throw new Error(`SMTP từ chối yêu cầu (${response.code}).`);
    }
    return response;
  }

  async upgradeToTls() {
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.socket = this.socket.startTls();
    this.reader = this.socket.readable.getReader();
    this.writer = this.socket.writable.getWriter();
    this.buffer = "";
    await this.socket.opened;
  }

  async sendData(source: string) {
    await this.writer.write(this.encoder.encode(`${source}\r\n.\r\n`));
    const response = await this.response();
    if (response.code !== 250) {
      throw new Error(`SMTP không chấp nhận nội dung email (${response.code}).`);
    }
  }

  async close() {
    try {
      await this.command("QUIT", [221]);
    } catch {
      // The message has already been accepted; a failed QUIT is non-fatal.
    }
    this.reader.releaseLock();
    this.writer.releaseLock();
    await this.socket.close().catch(() => undefined);
  }
}

export async function sendSmtpEmail(email: SmtpEmail) {
  const config = smtpConfig();
  if (!config) return null;
  const recipient = safeHeader(email.to);
  if (!validEmail(recipient) || !validEmail(config.fromEmail)) {
    throw new Error("Địa chỉ email gửi hoặc nhận không hợp lệ.");
  }

  const socket = connect(
    { hostname: config.host, port: config.port },
    {
      secureTransport: config.secure
        ? "on"
        : config.startTls
          ? "starttls"
          : "off",
    }
  );
  const session = new SmtpSession(socket);
  try {
    await session.opened();
    const greeting = await session.response();
    if (greeting.code !== 220) {
      throw new Error(`SMTP không sẵn sàng (${greeting.code}).`);
    }
    await session.command(`EHLO ${config.heloName}`, [250]);
    if (config.startTls) {
      await session.command("STARTTLS", [220]);
      await session.upgradeToTls();
      await session.command(`EHLO ${config.heloName}`, [250]);
    }
    if (config.username) {
      if (config.authMethod === "plain") {
        await session.command(
          `AUTH PLAIN ${toBase64(`\0${config.username}\0${config.password}`)}`,
          [235]
        );
      } else {
        await session.command("AUTH LOGIN", [334]);
        await session.command(toBase64(config.username), [334]);
        await session.command(toBase64(config.password), [235]);
      }
    }
    await session.command(`MAIL FROM:<${config.fromEmail}>`, [250]);
    await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
    await session.command("DATA", [354]);
    await session.sendData(
      messageSource(config, {
        ...email,
        to: recipient,
        subject: safeHeader(email.subject),
      })
    );
    return new Date().toISOString();
  } finally {
    await session.close();
  }
}
