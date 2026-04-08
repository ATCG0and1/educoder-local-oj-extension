export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const noopLogger: Logger = {
  info: () => {
    // no-op
  },
  warn: () => {
    // no-op
  },
  error: () => {
    // no-op
  },
};
