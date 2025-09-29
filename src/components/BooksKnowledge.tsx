import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, ExternalLink, RefreshCw, User, BookOpen, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { HistoricalFigure } from "./HistoricalChat";

interface BookInfo {
  id: string;
  title: string;
  authors: string[];
  description: string | null;
  published_date: string | null;
  page_count: number | null;
  categories: string[];
  thumbnail_url: string | null;
  preview_link: string | null;
  info_link: string | null;
  book_type: 'by_figure' | 'about_figure' | 'related';
  google_books_id: string;
  isbn_10: string | null;
  isbn_13: string | null;
  language: string;
}

interface BooksKnowledgeProps {
  selectedFigure: HistoricalFigure | null;
  onBooksDiscovered: (books: BookInfo[]) => void;
}

export default function BooksKnowledge({ selectedFigure, onBooksDiscovered }: BooksKnowledgeProps) {
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedFigure) {
      loadExistingBooks();
    } else {
      setBooks([]);
      setHasDiscovered(false);
    }
  }, [selectedFigure]);

  const loadExistingBooks = async () => {
    if (!selectedFigure) return;

    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('figure_id', selectedFigure.id)
        .order('book_type', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const typedBooks = data.map(book => ({
          ...book,
          book_type: book.book_type as 'by_figure' | 'about_figure' | 'related'
        }));
        setBooks(typedBooks);
        setHasDiscovered(true);
        onBooksDiscovered(typedBooks);
        console.log(`Loaded ${data.length} existing books for ${selectedFigure.name}`);
      }
    } catch (error) {
      console.error('Error loading existing books:', error);
    }
  };

  const discoverBooks = async (forceRefresh = false) => {
    if (!selectedFigure) return;

    setIsDiscovering(true);
    
    try {
      console.log(`Discovering books for ${selectedFigure.name}...`);
      
      const { data, error } = await supabase.functions.invoke('discover-books', {
        body: {
          figureName: selectedFigure.name,
          figureId: selectedFigure.id,
          forceRefresh
        }
      });

      if (error) throw error;

      if (data.success) {
        const typedBooks = data.books.map((book: any) => ({
          ...book,
          book_type: book.book_type as 'by_figure' | 'about_figure' | 'related'
        }));
        setBooks(typedBooks);
        setHasDiscovered(true);
        onBooksDiscovered(typedBooks);
        
        toast({
          title: "Books Discovered!",
          description: `Found ${data.totalBooks} books - ${data.breakdown?.by_figure || 0} by ${selectedFigure.name}, ${data.breakdown?.about_figure || 0} about them`,
        });

        console.log('Book discovery results:', data);
      } else {
        throw new Error(data.error || 'Failed to discover books');
      }
    } catch (error) {
      console.error('Error discovering books:', error);
      toast({
        title: "Discovery Failed",
        description: "Failed to discover books. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const getBookTypeIcon = (bookType: string) => {
    switch (bookType) {
      case 'by_figure': return <User className="h-3 w-3" />;
      case 'about_figure': return <Users className="h-3 w-3" />;
      default: return <BookOpen className="h-3 w-3" />;
    }
  };

  const getBookTypeLabel = (bookType: string) => {
    switch (bookType) {
      case 'by_figure': return 'By Figure';
      case 'about_figure': return 'About Figure';
      default: return 'Related';
    }
  };

  const getBookTypeColor = (bookType: string) => {
    switch (bookType) {
      case 'by_figure': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'about_figure': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const groupedBooks = books.reduce((acc, book) => {
    if (!acc[book.book_type]) {
      acc[book.book_type] = [];
    }
    acc[book.book_type].push(book);
    return acc;
  }, {} as Record<string, BookInfo[]>);

  if (!selectedFigure) {
    return (
      <Card className="p-4">
        <div className="text-center py-4 text-muted-foreground">
          <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a figure to discover their books</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Book className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Literary Knowledge</h3>
            {books.length > 0 && (
              <Badge variant="secondary">
                {books.length} books
              </Badge>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => discoverBooks(!hasDiscovered)}
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Book className="h-3 w-3" />
            )}
            {isDiscovering ? 'Discovering...' : hasDiscovered ? 'Refresh' : 'Discover'}
          </Button>
        </div>

        {!hasDiscovered && !isDiscovering && (
          <div className="text-center py-6 text-muted-foreground">
            <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm mb-2">Discover books by and about {selectedFigure.name}</p>
            <p className="text-xs">This will enhance their knowledge of their own works and legacy</p>
          </div>
        )}

        {isDiscovering && (
          <div className="text-center py-6">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-sm font-medium">Discovering books...</p>
            <p className="text-xs text-muted-foreground">Searching Google Books for works by and about {selectedFigure.name}</p>
          </div>
        )}

        {books.length > 0 && (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {Object.entries(groupedBooks).map(([bookType, booksInType]) => (
                <div key={bookType} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {getBookTypeIcon(bookType)}
                    <span className="text-sm font-medium">{getBookTypeLabel(bookType)}</span>
                    <Badge variant="outline" className="text-xs">
                      {booksInType.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 ml-5">
                    {booksInType.slice(0, 5).map((book) => (
                      <div
                        key={book.id}
                        className="p-2 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex items-start space-x-2">
                          {book.thumbnail_url && (
                            <img
                              src={book.thumbnail_url}
                              alt={book.title}
                              className="w-8 h-12 object-cover rounded flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium truncate">{book.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              by {book.authors.join(', ')}
                            </p>
                            {book.published_date && (
                              <p className="text-xs text-muted-foreground">
                                {book.published_date}
                              </p>
                            )}
                            <div className="flex items-center space-x-1 mt-1">
                              <Badge className={`text-xs ${getBookTypeColor(book.book_type)}`}>
                                {getBookTypeLabel(book.book_type)}
                              </Badge>
                              {book.preview_link && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1"
                                  onClick={() => window.open(book.preview_link, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {booksInType.length > 5 && (
                      <p className="text-xs text-muted-foreground ml-2">
                        +{booksInType.length - 5} more books...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {hasDiscovered && books.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Book className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No books found for {selectedFigure.name}</p>
            <p className="text-xs">Try refreshing or check the name spelling</p>
          </div>
        )}
      </div>
    </Card>
  );
}