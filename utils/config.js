require('dotenv').config();
const PORT = 3001;
const mongoUrl = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qx7so.mongodb.net/graphql_library?retryWrites=true&w=majority`;

module.exports = {
  mongoUrl,
  PORT
};
