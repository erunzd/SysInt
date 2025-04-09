// posts-service/index.js
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { PrismaClient } = require('@prisma/client');
const { EventEmitter } = require('events');

// Custom LocalPubSub to replace broken graphql-subscriptions
class LocalPubSub {
  constructor() {
    this.ee = new EventEmitter();
  }

  publish(event, payload) {
    this.ee.emit(event, payload);
  }

  asyncIterator(event) {
    const ee = this.ee;
    return {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return new Promise((resolve) => {
              const handler = (data) => {
                ee.removeListener(event, handler);
                resolve({ value: data, done: false });
              };
              ee.on(event, handler);
            });
          },
        };
      },
    };
  }
}

const prisma = new PrismaClient();
const pubsub = new LocalPubSub();
const POST_CREATED = 'POST_CREATED';

const typeDefs = `#graphql
  type Post {
    id: Int!
    title: String!
    content: String!
  }

  type Query {
    posts: [Post!]!
  }

  type Mutation {
    createPost(title: String!, content: String!): Post!
  }

  type Subscription {
    postCreated: Post!
  }
`;

const resolvers = {
  Query: {
    posts: () => prisma.post.findMany(),
  },
  Mutation: {
    createPost: async (_, args) => {
      const post = await prisma.post.create({ data: args });
      pubsub.publish(POST_CREATED, { postCreated: post });
      return post;
    },
  },
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(POST_CREATED),
    },
  },
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use('/graphql', cors(), express.json(), expressMiddleware(server));

  const PORT = 4002;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Posts service running at http://localhost:${PORT}/graphql`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer();
