'use client';

interface Book {
  title: string;
  cover: string;
  link: string;
  description?: string;
}

interface BookDisplayProps {
  books: Book[];
}

export function BookDisplay({ books }: BookDisplayProps) {
  return (
    <div className="bg-gradient-to-b from-amber-50 to-white rounded-lg p-4 border border-amber-200">
      <h3 className="font-serif font-bold text-gray-900 mb-3">My Books</h3>
      <div className="grid grid-cols-3 gap-3">
        {books.map((book, i) => (
          <a
            key={i}
            href={book.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-lg shadow group-hover:shadow-lg transition-shadow">
              <img
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <p className="text-xs text-gray-700 mt-1 text-center line-clamp-2 group-hover:text-amber-700">
              {book.title}
            </p>
          </a>
        ))}
      </div>
      <div className="mt-3 text-center">
        <a
          href="https://www.waterstones.com/author/vic-keegan/4942784"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium"
        >
          Buy at Waterstones →
        </a>
      </div>
    </div>
  );
}
