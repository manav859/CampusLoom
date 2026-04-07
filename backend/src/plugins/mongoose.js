import fp from 'fastify-plugin';
import mongoose from 'mongoose';

/**
 * Fastify plugin — initializes Mongoose connection.
 *
 * Mongoose maintains a global connection pool natively, so we connect
 * on start and gracefully disconnect on Fastify teardown.
 */
async function mongoosePlugin(fastify) {
  try {
    const isDev = fastify.config.NODE_ENV === 'development';
    
    if (isDev) {
      mongoose.set('debug', true);
    }

    await mongoose.connect(fastify.config.DATABASE_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    
    fastify.log.info('📦 MongoDB connected via Mongoose');

    // Make the mongoose instance easily reachable if needed, though models
    // are usually imported directly via the mongoose singleton.
    fastify.decorate('mongoose', mongoose);

    fastify.addHook('onClose', async (instance) => {
      await mongoose.disconnect();
      instance.log.info('📦 MongoDB disconnected');
    });
  } catch (error) {
    fastify.log.fatal(error, '❌ MongoDB connection failed');
    throw error;
  }
}

export default fp(mongoosePlugin, {
  name: 'mongoose',
});
