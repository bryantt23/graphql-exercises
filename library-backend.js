const { ApolloServer, gql, UserInputError } = require('apollo-server');
const { v4: uuid } = require('uuid');
const mongoose = require('mongoose');
const config = require('./utils/config');
const Book = require('./models/Book');
const Author = require('./models/Author');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.SECRET;

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

// https://stackoverflow.com/questions/7503450/how-do-you-turn-a-mongoose-document-into-a-plain-object
async function getPopulatedBooks() {
  return await Book.find({}).lean().populate('author', 'name').exec();
}

const typeDefs = gql`
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  type Token {
    value: String!
  }
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author]!
    me: User
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
    createUser(username: String!, favoriteGenre: String!): User
    login(username: String!, password: String!): Token
  }
`;
const resolvers = {
  Query: {
    bookCount: async args => {
      let books = await getBooks();
      if (!args) {
        return books.length;
      }
      return books.filter(book => book.author === args).length;
    },
    authorCount: async () => {
      let authors = await getAuthors();
      return authors.length;
    },
    allBooks: async (root, args) => {
      console.log('args', args);
      let booksWithAuthors = await getPopulatedBooks();
      // console.log('booksWithAuthors', booksWithAuthors);

      booksWithAuthors = booksWithAuthors.map(book => {
        console.log('book.author.name', book.author.name);
        book.author = book.author.name;
        return book;
      });

      if (!args.author && !args.genre) {
        return booksWithAuthors;
      } else if (args.author && args.genre) {
        return booksWithAuthors
          .filter(book => book.author === args.author)
          .filter(book => book.genres.includes(args.genre));
      } else if (args.author) {
        return booksWithAuthors.filter(book => book.author === args.author);
      } else {
        return booksWithAuthors.filter(book =>
          book.genres.includes(args.genre)
        );
      }
    },
    allAuthors: async () => {
      let authors = await getAuthors();
      console.log('authors', authors);
      return authors;
    }
  },
  Mutation: {
    createUser: (root, args) => {
      const user = new User({
        username: args.username,
        favoriteGenre: args.favoriteGenre
      });
      return user.save().catch(error => {
        throw new UserInputError(error.message, {
          invalidArgs: args
        });
      });
    },
    login: async (root, args) => {
      console.log(args);
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== 'secret') {
        throw new UserInputError('wrong credentials');
      }

      const userForToken = {
        username: user.username,
        id: user._id
      };

      return { value: jwt.sign(userForToken, JWT_SECRET) };
    },

    addBook: async (root, args) => {
      const book = { ...args, id: uuid() };
      console.log('...args', args);
      const { author } = book;
      console.log('author ', author);
      let authors = await getAuthors();
      console.log('authors ', authors);
      let authorFromDb = authors.find(a => a.name === author);
      if (!authorFromDb) {
        console.log('authorFromDb does not exist');
        // authors = authors.concat({ name: author, id: uuid() });
        //post new author
        authorFromDb = await new Author({ name: author });
        const result = await authorFromDb.save();
        console.log('new author', result);
      } else {
        console.log('authorFromDb does exist', authorFromDb);
      }

      //create new book & post to db
      try {
        const newBook = await new Book({
          ...args,
          author: authorFromDb._id
        });
        const result = await newBook.save();
        console.log('new book', result);
      } catch (error) {
        console.log('error', error);
        throw new UserInputError(error, {
          invalidArgs: Object.keys(args)
        });
      }

      // console.log('authors ', authors);
      // console.log('book ', book);
      // console.log('addBook ', args);
      // books = books.concat(book);
      // console.log('books last', books[books.length - 1]);
      return book;
    },
    editAuthor: async (root, args) => {
      let authors = await getAuthors();
      console.log('editAuthor');
      console.log('args ', args);
      const { name } = args;
      console.log('name ', name);
      let author = authors.find(a => a.name === name);
      if (!author) {
        console.log('does not exist');
        return null;
      } else {
        console.log('author', author);
        console.log('does exist');
        const updatedAuthor = await Author.findOne({ _id: author.id }).catch(
          err => {
            console.log('err', err);
          }
        );
        updatedAuthor.born = args.setBornTo;
        updatedAuthor.save().catch(function (err) {
          console.log('err', err);
        });

        return updatedAuthor;
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
    bookCount: async root => {
      const booksAuthors = await getPopulatedBooks();
      return booksAuthors.filter(book => {
        return book.author.name === root.name;
      }).length;
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith('bearer')) {
      const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
      const currentUser = await UserInputError.findById(decodedToken.id);
      return { currentUser };
    }
  }
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
