// Maps historical figures to appropriate environmental contexts for avatar generation

interface FigureContext {
  context: string;
  keywords: string[];
}

const figureContexts: Record<string, FigureContext> = {
  // Scientists
  scientist: {
    context: 'laboratory with scientific equipment, beakers, and chalkboard with equations',
    keywords: ['einstein', 'curie', 'newton', 'darwin', 'galileo', 'hawking', 'tesla', 'edison', 'faraday', 'bohr', 'feynman', 'oppenheimer', 'planck', 'heisenberg', 'schrodinger', 'pasteur', 'mendel', 'copernicus', 'kepler', 'lovelace', 'turing', 'scientist', 'physicist', 'chemist', 'biologist']
  },
  
  // US Presidents
  president_us: {
    context: 'Oval Office with American flag, presidential desk, and historical paintings',
    keywords: ['lincoln', 'washington', 'jefferson', 'roosevelt', 'kennedy', 'obama', 'reagan', 'nixon', 'truman', 'eisenhower', 'clinton', 'bush', 'adams', 'madison', 'monroe', 'wilson', 'hoover', 'coolidge', 'taft', 'mckinley', 'grant', 'garfield', 'harrison', 'tyler', 'polk', 'taylor', 'fillmore', 'pierce', 'buchanan', 'johnson', 'hayes', 'arthur', 'cleveland', 'harding', 'ford', 'carter', 'biden', 'trump']
  },
  
  // World Leaders (non-US)
  world_leader: {
    context: 'grand government office with national flags and ornate furnishings',
    keywords: ['churchill', 'thatcher', 'gandhi', 'mandela', 'napoleon', 'caesar', 'alexander', 'cleopatra', 'victoria', 'elizabeth', 'charles', 'louis', 'catherine', 'peter', 'frederick', 'bismarck', 'de gaulle', 'mao', 'stalin', 'lenin', 'gorbachev', 'putin', 'merkel', 'macron', 'trudeau', 'modi', 'netanyahu', 'kim', 'castro', 'che', 'bolivar', 'san martin', 'ataturk', 'saladin', 'genghis', 'ashoka', 'akbar']
  },
  
  // Composers & Musicians
  composer: {
    context: 'elegant music room with grand piano, sheet music, and ornate chandelier',
    keywords: ['beethoven', 'mozart', 'bach', 'chopin', 'tchaikovsky', 'brahms', 'wagner', 'handel', 'haydn', 'schubert', 'schumann', 'liszt', 'verdi', 'puccini', 'vivaldi', 'debussy', 'stravinsky', 'mahler', 'dvorak', 'mendelssohn', 'composer', 'musician', 'pianist', 'symphony']
  },
  
  // Artists & Painters
  artist: {
    context: 'artist studio with easel, canvases, paint brushes, and natural light from large windows',
    keywords: ['da vinci', 'michelangelo', 'picasso', 'van gogh', 'rembrandt', 'monet', 'dali', 'warhol', 'frida', 'kahlo', 'raphael', 'caravaggio', 'vermeer', 'renoir', 'cezanne', 'gauguin', 'matisse', 'kandinsky', 'pollock', 'rothko', 'botticelli', 'donatello', 'bernini', 'rodin', 'artist', 'painter', 'sculptor']
  },
  
  // Philosophers
  philosopher: {
    context: 'ancient library with scrolls, books, marble columns, and contemplative atmosphere',
    keywords: ['socrates', 'plato', 'aristotle', 'confucius', 'nietzsche', 'kant', 'descartes', 'hegel', 'locke', 'rousseau', 'voltaire', 'spinoza', 'hume', 'kierkegaard', 'sartre', 'camus', 'wittgenstein', 'russell', 'marx', 'aquinas', 'augustine', 'epicurus', 'seneca', 'marcus aurelius', 'lao tzu', 'sun tzu', 'philosopher']
  },
  
  // Writers & Authors
  writer: {
    context: 'cozy study with antique desk, leather-bound books, quill pen, and warm lamp light',
    keywords: ['shakespeare', 'dickens', 'twain', 'hemingway', 'austen', 'bronte', 'tolstoy', 'dostoevsky', 'orwell', 'wilde', 'poe', 'byron', 'shelley', 'keats', 'wordsworth', 'whitman', 'frost', 'eliot', 'joyce', 'woolf', 'kafka', 'proust', 'hugo', 'dumas', 'verne', 'wells', 'asimov', 'tolkien', 'lewis', 'rowling', 'author', 'writer', 'poet', 'novelist', 'playwright']
  },
  
  // Religious Figures
  religious: {
    context: 'sacred temple or cathedral with stained glass, candles, and spiritual atmosphere',
    keywords: ['jesus', 'buddha', 'muhammad', 'moses', 'abraham', 'pope', 'dalai lama', 'mother teresa', 'luther', 'calvin', 'paul', 'peter', 'mary', 'joseph', 'john', 'francis', 'thomas', 'augustine', 'aquinas', 'saint', 'prophet', 'apostle', 'guru', 'imam', 'rabbi', 'monk', 'nun', 'religious', 'spiritual']
  },
  
  // Military Leaders
  military: {
    context: 'military command tent with strategic maps, battle plans, and military regalia',
    keywords: ['patton', 'rommel', 'macarthur', 'eisenhower', 'montgomery', 'zhukov', 'wellington', 'nelson', 'hannibal', 'scipio', 'spartacus', 'leonidas', 'attila', 'saladin', 'richard', 'edward', 'joan of arc', 'samurai', 'shogun', 'general', 'admiral', 'commander', 'warrior', 'soldier']
  },
  
  // Explorers
  explorer: {
    context: 'ship deck or expedition camp with maps, compass, telescope, and adventure gear',
    keywords: ['columbus', 'magellan', 'marco polo', 'cook', 'drake', 'hudson', 'lewis', 'clark', 'livingstone', 'stanley', 'shackleton', 'amundsen', 'hillary', 'armstrong', 'aldrin', 'gagarin', 'explorer', 'navigator', 'astronaut', 'cosmonaut', 'adventurer', 'discoverer']
  },
  
  // Tech Entrepreneurs
  tech: {
    context: 'modern tech office with multiple monitors, sleek design, and innovation atmosphere',
    keywords: ['jobs', 'gates', 'musk', 'bezos', 'zuckerberg', 'wozniak', 'allen', 'page', 'brin', 'dorsey', 'sandberg', 'nadella', 'pichai', 'cook', 'entrepreneur', 'founder', 'ceo', 'tech', 'silicon valley']
  },
  
  // Athletes
  athlete: {
    context: 'sports arena or training facility with athletic equipment and championship atmosphere',
    keywords: ['jordan', 'ali', 'pele', 'maradona', 'messi', 'ronaldo', 'bolt', 'phelps', 'serena', 'federer', 'nadal', 'woods', 'ruth', 'gretzky', 'brady', 'james', 'kobe', 'shaq', 'athlete', 'champion', 'olympic', 'sports']
  },
  
  // Activists & Reformers
  activist: {
    context: 'public rally or community center with protest signs, podium, and diverse crowd',
    keywords: ['king', 'malcolm x', 'parks', 'tubman', 'douglass', 'truth', 'anthony', 'stanton', 'steinem', 'chavez', 'mandela', 'gandhi', 'pankhurst', 'wollstonecraft', 'activist', 'reformer', 'civil rights', 'suffragette', 'abolitionist']
  },
  
  // Entertainers
  entertainer: {
    context: 'glamorous stage or film set with spotlights, curtains, and Hollywood atmosphere',
    keywords: ['chaplin', 'monroe', 'presley', 'sinatra', 'beatles', 'lennon', 'bowie', 'jackson', 'prince', 'mercury', 'hendrix', 'joplin', 'morrison', 'cobain', 'streisand', 'hepburn', 'brando', 'dean', 'wayne', 'bogart', 'actor', 'actress', 'singer', 'rock star', 'entertainer']
  },
  
  // Medical Pioneers
  medical: {
    context: 'medical facility or hospital with medical equipment and healing atmosphere',
    keywords: ['hippocrates', 'nightingale', 'fleming', 'salk', 'jenner', 'pasteur', 'lister', 'harvey', 'galen', 'vesalius', 'koch', 'ehrlich', 'barnard', 'schweitzer', 'doctor', 'nurse', 'surgeon', 'physician', 'healer', 'medical']
  },
  
  // Economists & Business
  economist: {
    context: 'Wall Street office or trading floor with financial charts and business atmosphere',
    keywords: ['smith', 'keynes', 'friedman', 'marx', 'hayek', 'ricardo', 'malthus', 'morgan', 'rockefeller', 'carnegie', 'ford', 'buffett', 'soros', 'economist', 'banker', 'financier', 'industrialist', 'tycoon']
  }
};

/**
 * Maps a historical figure name to an appropriate environmental context
 * for avatar portrait generation
 */
export function getFigureContext(figureName: string): string {
  const nameLower = figureName.toLowerCase();
  
  // Check each category for matching keywords
  for (const [category, data] of Object.entries(figureContexts)) {
    for (const keyword of data.keywords) {
      if (nameLower.includes(keyword)) {
        console.log(`🎨 Matched "${figureName}" to category "${category}"`);
        return data.context;
      }
    }
  }
  
  // Default fallback - professional but contextual
  console.log(`🎨 No specific context match for "${figureName}", using thoughtful default`);
  return 'distinguished setting appropriate to their historical era and profession';
}

/**
 * Get the category name for a figure (for logging/debugging)
 */
export function getFigureCategory(figureName: string): string | null {
  const nameLower = figureName.toLowerCase();
  
  for (const [category, data] of Object.entries(figureContexts)) {
    for (const keyword of data.keywords) {
      if (nameLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}
