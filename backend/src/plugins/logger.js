/**
 * Pino logger configuration.
 *
 * - Development: pretty-printed, coloured output.
 * - Production:  structured JSON (machine-parseable).
 *
 * Returns a config object to be passed to Fastify({ logger: ... }).
 */
export function buildLoggerConfig(nodeEnv) {
  const isDev = nodeEnv === 'development';

  return {
    level: isDev ? 'info' : 'warn',
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }),
  };
}
