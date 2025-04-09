// posts-service/index.js
const { ApolloServer, gql } = require('apollo-server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const typeDefs = gql`
  type Post {
    id: Int!
    title: String!
    content: String!
  }

  type Query {
    posts: [Post!]!
    post(id: Int!): Post
  }

  type Mutation {
    createPost(title: String!, content: String!): Post!
    updatePost(id: Int!, title: String, content: String): Post!
    deletePost(id: Int!): Post!
  }
`;

const resolvers = {
  Query: {
    posts: () => prisma.post.findMany(),
    post: (_, args) => prisma.post.findUnique({ where: { id: args.id } }),
  },
  Mutation: {
    createPost: (_, args) => prisma.post.create({ data: args }),
    updatePost: (_, args) =>
      prisma.post.update({ where: { id: args.id }, data: args }),
    deletePost: (_, args) =>
      prisma.post.delete({ where: { id: args.id } }),
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen({ port: 4002 }).then(({ url }) => {
  console.log(`🚀 Posts service ready at ${url}`);
});
