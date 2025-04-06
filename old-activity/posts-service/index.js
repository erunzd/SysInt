const { ApolloServer } = require("@apollo/server");
const { createServer } = require("http");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { useServer } = require("graphql-ws/lib/use/ws");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const express = require("express");
const { expressMiddleware } = require("@apollo/server/express4");
const cors = require("cors");
const bodyParser = require("body-parser");
const gql = require("graphql-tag");

const prisma = new PrismaClient();

// Custom PubSub Implementation
class SimplePubSub {
  constructor() {
    this.subscriptions = {};
    this.nextSubscriptionId = 0;
  }

  publish(triggerName, payload) {
    console.log(`Publishing to ${triggerName}:`, payload);
    if (this.subscriptions[triggerName]) {
      Object.values(this.subscriptions[triggerName]).forEach((callback) =>
        callback(payload)
      );
    }
  }

  subscribe(triggerName, onMessage) {
    console.log(`Subscribing to ${triggerName}`);
    const id = this.nextSubscriptionId++;
    if (!this.subscriptions[triggerName]) {
      this.subscriptions[triggerName] = {};
    }
    this.subscriptions[triggerName][id] = onMessage;
    return () => {
      delete this.subscriptions[triggerName][id];
      if (Object.keys(this.subscriptions[triggerName]).length === 0) {
        delete this.subscriptions[triggerName];
      }
    };
  }

  asyncIterator(triggers) {
    console.log(`Creating asyncIterator for triggers:`, triggers);
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        const triggerNames = Array.isArray(triggers) ? triggers : [triggers];
        const buffer = [];
        const pushValue = (payload) => buffer.push(payload);
        const subscriptions = triggerNames.map((triggerName) =>
          self.subscribe(triggerName, pushValue)
        );

        return {
          next() {
            console.log("Waiting for next value...");
            if (buffer.length === 0) {
              return new Promise((resolve) => {
                const interval = setInterval(() => {
                  if (buffer.length > 0) {
                    clearInterval(interval);
                    resolve({
                      done: false,
                      value: buffer.shift(),
                    });
                  }
                }, 100);
              });
            }
            return Promise.resolve({
              done: false,
              value: buffer.shift(),
            });
          },
          return() {
            console.log("Cleaning up subscriptions...");
            subscriptions.forEach((unsubscribe) => unsubscribe());
            return Promise.resolve({ done: true });
          },
        };
      },
    };
  }
}

const pubsub = new SimplePubSub();
const POST_CREATED = "POST_CREATED";

// Define GraphQL Schema
const typeDefs = gql`
  type Post {
    id: ID!
    title: String!
    content: String!
    authorId: Int!
  }

  type Query {
    posts: [Post]
    post(id: ID!): Post
  }

  type Mutation {
    createPost(title: String!, content: String!, authorId: Int!): Post
    updatePost(id: ID!, title: String, content: String): Post
    deletePost(id: ID!): Post
  }

  type Subscription {
    postCreated: Post
  }
`;

const resolvers = {
  Query: {
    posts: () => prisma.post.findMany(),
    post: (_, { id }) => prisma.post.findUnique({ where: { id: Number(id) } }),
  },
  Mutation: {
    createPost: async (_, { title, content, authorId }) => {
      const post = await prisma.post.create({ data: { title, content, authorId } });
      pubsub.publish(POST_CREATED, { postCreated: post });
      return post;
    },
  },
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator([POST_CREATED]),
    },
  },
};

// Create Express app
const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json());

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create an HTTP server
const httpServer = createServer(app);

// Create WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

// Ensure WebSocket context includes pubsub
useServer(
  {
    schema,
    context: () => ({ pubsub }), // ✅ Fix: Ensure pubsub is available for subscriptions
    onConnect: () => console.log("🔗 WebSocket Connected"),
    onDisconnect: () => console.log("❌ WebSocket Disconnected"),
  },
  wsServer
);

// Create Apollo Server with proper context
const server = new ApolloServer({
  schema,
  context: async () => ({ pubsub }), // ✅ Fix: Pass pubsub to the main context
  plugins: [
    {
      async serverWillStart() {
        return {
          async drainServer() {
            console.log("🛑 Draining WebSocket server...");
            await wsServer.close();
          },
        };
      },
    },
  ],
});

async function startServer() {
  await server.start();
  app.use("/graphql", expressMiddleware(server));

  const PORT = 4002;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer();
