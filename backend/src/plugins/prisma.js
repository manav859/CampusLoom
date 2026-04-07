import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

/**
 * Fastify plugin — attaches a singleton PrismaClient to the Fastify instance.
 *
 * Usage inside routes / services:
 *   const prisma = fastify.prisma;
 */
async function prismaPlugin(fastify) {
  const prisma = new PrismaClient({
    log:
      fastify.config.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

  await prisma.$connect();
  fastify.log.info('📦 Prisma connected to database');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    instance.log.info('📦 Prisma disconnected');
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});
