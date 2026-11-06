// Fills the database with a demo account and sample books for testing.
// Run with: node server/seed.js          (adds the demo data if it isn't there yet)
//           node server/seed.js --reset  (clears the demo account's books first)
const { db, users, books } = require('./db');

const DEMO = { email: 'demo@hobbyshelf.test', name: 'Demo Reader' };

// Real titles with real ISBNs, so Open Library covers show up on the shelf.
const SAMPLE_BOOKS = [
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780547928227' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', isbn: '9780141439518' },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565' },
  { title: '1984', author: 'George Orwell', isbn: '9780451524935' },
  { title: 'The Catcher in the Rye', author: 'J.D. Salinger', isbn: '9780316769488' },
  { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
  { title: 'The Name of the Wind', author: 'Patrick Rothfuss', isbn: '9780756404741' }
];

const reset = process.argv.includes('--reset');
const user = users.upsert(DEMO.email, DEMO.name);

if (reset) db.prepare('DELETE FROM books WHERE user_id = ?').run(user.id);

const existing = books.listForUser(user.id);
if (existing.length > 0 && !reset) {
  console.log(`Demo account already has ${existing.length} books. Use --reset to reload them.`);
} else {
  SAMPLE_BOOKS.forEach((book) => books.add(user.id, book));
  console.log(`Added ${SAMPLE_BOOKS.length} sample books for ${DEMO.email}.`);
}
console.log(`Log in as ${DEMO.email} to see them.`);