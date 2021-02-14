const { ApolloServer, gql } = require('apollo-server');
const { v4: uuid } = require('uuid');
const mongoose = require('mongoose');
const config = require('./utils/config');
const Book = require('./models/Book');
const Author = require('./models/Author');

mongoose.connect(config.mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
});

async function getBooks() {
  return await Book.find({});
}

async function getAuthors() {
  return await Author.find({});
}

const typeDefs = gql`
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author]!
  }
  type Book {
    title: String!
    published: Int!
    author: String!
    genres: [String!]!
    id: ID!
  }
  type Author {
    name: String!
    born: Int
    id: String!
    bookCount: Int!
  }
  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book
    editAuthor(name: String!, setBornTo: Int!): Author
  }
`;
const resolvers = {
  Query: {
    bookCount: args => {
      if (!args) {
        return books.length;
      }
      return books.filter(book => book.author === args).length;
    },
    authorCount: () => authors.length,
    allBooks: async (root, args) => {
      let books = await getBooks();
      console.log('books', books);
      console.log('args', args);
      if (!args.author && !args.genre) {
        return books;
      } else if (args.author && args.genre) {
        return books
          .filter(book => book.author === args.author)
          .filter(book => book.genres.includes(args.genre));
      } else if (args.author) {
        return books.filter(book => book.author === args.author);
      } else {
        return books.filter(book => book.genres.includes(args.genre));
      }
    },
    allAuthors: async () => {
      let authors = await getAuthors();
      console.log('authors', authors);
      return authors;
    }
  },
  Mutation: {
    addBook: (root, args) => {
      const book = { ...args, id: uuid() };
      const { author } = book;
      console.log('author ', author);
      if (!authors.find(a => a.name === author)) {
        console.log('does not exist');
        authors = authors.concat({ name: author, id: uuid() });
      } else {
        console.log('does  exist');
      }
      console.log('authors ', authors);
      console.log('book ', book);
      console.log('addBook ', args);
      books = books.concat(book);
      console.log('books last', books[books.length - 1]);
      return book;
    },
    editAuthor: (root, args) => {
      console.log('editAuthor');
      console.log('args ', args);
      const { name } = args;
      console.log('name ', name);
      let author = authors.find(a => a.name === name);
      if (!author) {
        console.log('does not exist');
        return null;
      } else {
        author.born = args.setBornTo;
        return author;
      }
    }
  },
  Book: {
    title: root => root.title,
    published: root => root.published,
    author: root => root.author,
    id: root => root.id,
    genres: root => root.genres
  },
  Author: {
    name: root => root.name,
    born: root => root.born,
    id: root => root.id,
    bookCount: root => books.filter(book => book.author === root.name).length
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
