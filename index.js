const { gql, ApolloClient, InMemoryCache } = require("@apollo/client/core");
const { SchemaLink } = require("@apollo/client/link/schema");
const { makeExecutableSchema } = require("@graphql-tools/schema");

function uuid(label) {
  return () => `${label}-${Math.random().toString(16).substr(2)}`;
}

function emptyList(len) {
  return new Array(len).fill(true);
}

const client = new ApolloClient({
  link: new SchemaLink({
    schema: makeExecutableSchema({
      typeDefs: /* GraphQL */ `
        type Query {
          chat(id: ID!): Chat!
        }

        type Chat {
          id: ID!
          name: String!
          messages: [Message!]!
          members: [User!]!
        }

        type Message {
          id: ID!
          author: User!
          reactions: [Reaction!]!
          viewedBy: [User!]!
        }

        type User {
          id: ID!
          name: String!
        }

        type Reaction {
          id: ID!
          type: String!
          author: User!
        }
      `,
      resolvers: {
        Query: {
          chat(_, { id }) {
            return id;
          },
        },
        Chat: {
          id(id) {
            return id;
          },
          name(id) {
            return id;
          },
          messages() {
            return emptyList(10);
          },
          members() {
            return emptyList(10);
          },
        },
        Message: {
          id: uuid("Message"),
          author() {
            return { foo: true };
          },
          reactions() {
            return emptyList(10);
          },
          viewedBy() {
            return emptyList(10);
          },
        },
        User: {
          id: uuid("User"),
          name: uuid("User.name"),
        },
        Reaction: {
          id: uuid("Reaction"),
          type: uuid("Reaction.type"),
          author() {
            return { foo: true };
          },
        },
      },
    }),
  }),
  cache: new InMemoryCache(),
});

const LONG_QUERY = gql`
  query getChat($id: ID!) {
    chat(id: $id) {
      id
      name
      messages {
        ...message
      }
      members {
        ...user
      }
    }
  }

  fragment user on User {
    id
    name
  }

  fragment reaction on Reaction {
    id
    type
    author {
      ...user
    }
  }

  fragment message on Message {
    id
    author {
      ...user
    }
    reactions {
      ...reaction
    }
    viewedBy {
      ...user
    }
  }
`;

const SHORT_QUERY = gql`
  query getChat($id: ID!) {
    chat(id: $id) {
      id
      name
    }
  }
`;

function query(id) {
  let resolved = false;
  return new Promise((resolve, reject) => {
    const sub = client
      .watchQuery({
        query: LONG_QUERY,
        variables: {
          id,
        },
      })
      .subscribe({
        next(result) {
          if (!resolved) {
            resolved = true;
            resolve(sub);
          }
        },
        error(error) {
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        },
      });
  });
}

const waitFor = (time) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

const [, , repeat = 3] = process.argv;

async function main() {
  const repeats = new Array(repeat).fill(null);
  for await (const i of repeats) {
    const sub1 = await query(`one-${i}`);
    sub1.unsubscribe();
    await waitFor(500);
    await waitFor(1500);
    console.log("TAKE A HEAPSNAPSHOT");
    debugger;
  }

  client.cache.evict({
    id: "ROOT_QUERY",
  });
  client.cache.gc();
  gql.resetCaches();
  await waitFor(500);
  await waitFor(1500);
  console.log("TAKE A HEAPSNAPSHOT");
  debugger;
}

main().catch((error) => {
  console.error(error);
});
