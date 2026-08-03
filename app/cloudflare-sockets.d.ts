declare module "cloudflare:sockets" {
  export type SecureTransport = "off" | "on" | "starttls";

  export type SocketAddress = {
    hostname: string;
    port: number;
  };

  export type SocketOptions = {
    secureTransport?: SecureTransport;
    allowHalfOpen?: boolean;
  };

  export type Socket = {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    opened: Promise<unknown>;
    closed: Promise<void>;
    close(): Promise<void>;
    startTls(): Socket;
  };

  export function connect(
    address: SocketAddress | string,
    options?: SocketOptions
  ): Socket;
}
