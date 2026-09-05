export type TriviaChoice = { id: string; text: string };
export type TriviaQuestion = {
  id: string;
  pack: 'film' | 'books' | 'city';
  difficulty: 1 | 2 | 3;
  prompt: string;
  choices: TriviaChoice[];
  correctChoiceId: string;
  explanation: string;
  tags: string[];
  contentVersion: 1;
};

type CultureFact = { slug: string; title: string; creator: string; year: number };

const FILMS: CultureFact[] = [
  ['godfather', 'The Godfather', 'Francis Ford Coppola', 1972], ['jaws', 'Jaws', 'Steven Spielberg', 1975],
  ['star-wars', 'Star Wars', 'George Lucas', 1977], ['alien', 'Alien', 'Ridley Scott', 1979],
  ['back-future', 'Back to the Future', 'Robert Zemeckis', 1985], ['princess-bride', 'The Princess Bride', 'Rob Reiner', 1987],
  ['do-right-thing', 'Do the Right Thing', 'Spike Lee', 1989], ['goodfellas', 'Goodfellas', 'Martin Scorsese', 1990],
  ['silence-lambs', 'The Silence of the Lambs', 'Jonathan Demme', 1991], ['pulp-fiction', 'Pulp Fiction', 'Quentin Tarantino', 1994],
  ['toy-story', 'Toy Story', 'John Lasseter', 1995], ['titanic', 'Titanic', 'James Cameron', 1997],
  ['matrix', 'The Matrix', 'Lana and Lilly Wachowski', 1999], ['spirited-away', 'Spirited Away', 'Hayao Miyazaki', 2001],
  ['fellowship', 'The Lord of the Rings: The Fellowship of the Ring', 'Peter Jackson', 2001], ['city-god', 'City of God', 'Fernando Meirelles', 2002],
  ['eternal-sunshine', 'Eternal Sunshine of the Spotless Mind', 'Michel Gondry', 2004], ['pans-labyrinth', "Pan's Labyrinth", 'Guillermo del Toro', 2006],
  ['dark-knight', 'The Dark Knight', 'Christopher Nolan', 2008], ['grand-budapest', 'The Grand Budapest Hotel', 'Wes Anderson', 2014],
  ['fury-road', 'Mad Max: Fury Road', 'George Miller', 2015], ['moonlight', 'Moonlight', 'Barry Jenkins', 2016],
  ['get-out', 'Get Out', 'Jordan Peele', 2017], ['parasite', 'Parasite', 'Bong Joon Ho', 2019],
  ['dune', 'Dune', 'Denis Villeneuve', 2021],
].map(([slug, title, creator, year]) => ({ slug: String(slug), title: String(title), creator: String(creator), year: Number(year) }));

const BOOKS: CultureFact[] = [
  ['pride-prejudice', 'Pride and Prejudice', 'Jane Austen', 1813], ['frankenstein', 'Frankenstein', 'Mary Shelley', 1818],
  ['moby-dick', 'Moby-Dick', 'Herman Melville', 1851], ['alice', "Alice's Adventures in Wonderland", 'Lewis Carroll', 1865],
  ['little-women', 'Little Women', 'Louisa May Alcott', 1868], ['treasure-island', 'Treasure Island', 'Robert Louis Stevenson', 1883],
  ['dorian-gray', 'The Picture of Dorian Gray', 'Oscar Wilde', 1890], ['dracula', 'Dracula', 'Bram Stoker', 1897],
  ['wizard-oz', 'The Wonderful Wizard of Oz', 'L. Frank Baum', 1900], ['peter-pan', 'Peter and Wendy', 'J. M. Barrie', 1911],
  ['gatsby', 'The Great Gatsby', 'F. Scott Fitzgerald', 1925], ['hobbit', 'The Hobbit', 'J. R. R. Tolkien', 1937],
  ['rebecca', 'Rebecca', 'Daphne du Maurier', 1938], ['nineteen-eighty-four', 'Nineteen Eighty-Four', 'George Orwell', 1949],
  ['catcher-rye', 'The Catcher in the Rye', 'J. D. Salinger', 1951], ['charlottes-web', "Charlotte's Web", 'E. B. White', 1952],
  ['fahrenheit', 'Fahrenheit 451', 'Ray Bradbury', 1953], ['lord-flies', 'Lord of the Flies', 'William Golding', 1954],
  ['mockingbird', 'To Kill a Mockingbird', 'Harper Lee', 1960], ['dune-book', 'Dune', 'Frank Herbert', 1965],
  ['handmaids-tale', "The Handmaid's Tale", 'Margaret Atwood', 1985], ['matilda', 'Matilda', 'Roald Dahl', 1988],
  ['philosophers-stone', "Harry Potter and the Philosopher's Stone", 'J. K. Rowling', 1997], ['book-thief', 'The Book Thief', 'Markus Zusak', 2005],
  ['hunger-games', 'The Hunger Games', 'Suzanne Collins', 2008],
].map(([slug, title, creator, year]) => ({ slug: String(slug), title: String(title), creator: String(creator), year: Number(year) }));

function makePack(pack: 'film' | 'books', facts: CultureFact[]): TriviaQuestion[] {
  const creatorLabel = pack === 'film' ? 'directed' : 'written';
  return facts.flatMap((fact, index) => {
    const creators = alternatives(facts, index, (item) => item.creator);
    const titles = alternatives(facts, index, (item) => item.title);
    const years = alternatives(facts, index, (item) => String(item.year));
    const pairings = alternatives(facts, index, (item) => `${item.title} — ${item.creator}`);
    return [
      question(pack, `${fact.slug}-creator`, `Who ${creatorLabel} ${fact.title}?`, creators, fact.creator, `${fact.title} was ${creatorLabel} by ${fact.creator}.`, ['creator']),
      question(pack, `${fact.slug}-title`, `Which title was ${creatorLabel} by ${fact.creator}?`, titles, fact.title, `${fact.creator} ${creatorLabel} ${fact.title}.`, ['title']),
      question(pack, `${fact.slug}-year`, `When was ${fact.title} first released?`, years, String(fact.year), `${fact.title} was first released in ${fact.year}.`, ['year']),
      question(pack, `${fact.slug}-pair`, `Which pairing correctly includes ${fact.title}?`, pairings, `${fact.title} — ${fact.creator}`, `${fact.title} is paired with ${fact.creator}.`, ['pairing']),
    ];
  });
}

function alternatives(facts: CultureFact[], index: number, pick: (fact: CultureFact) => string): string[] {
  const values: string[] = [];
  for (let offset = 0; offset < facts.length && values.length < 4; offset += 1) {
    const value = pick(facts[(index + offset * 7) % facts.length]);
    if (!values.includes(value)) values.push(value);
  }
  return values;
}

function question(pack: 'film' | 'books' | 'city', id: string, prompt: string, values: string[], correct: string, explanation: string, tags: string[]): TriviaQuestion {
  const ordered = seededShuffle(Array.from(new Set([correct, ...values])).slice(0, 4), `${pack}:${id}`);
  const choices = ordered.map((text, index) => ({ id: `${id}:${index}`, text }));
  return {
    id: `${pack}:${id}`,
    pack,
    difficulty: 1,
    prompt,
    choices,
    correctChoiceId: choices.find((choice) => choice.text === correct)?.id ?? choices[0].id,
    explanation,
    tags,
    contentVersion: 1,
  };
}

export const FILM_TRIVIA_QUESTIONS = makePack('film', FILMS);
export const BOOK_TRIVIA_QUESTIONS = makePack('books', BOOKS);

type CapitalFact = { slug: string; city: string; country: string };
const CAPITALS: CapitalFact[] = [
  ['london','London','United Kingdom'],['paris','Paris','France'],['rome','Rome','Italy'],['madrid','Madrid','Spain'],['lisbon','Lisbon','Portugal'],
  ['dublin','Dublin','Ireland'],['oslo','Oslo','Norway'],['stockholm','Stockholm','Sweden'],['helsinki','Helsinki','Finland'],['copenhagen','Copenhagen','Denmark'],
  ['reykjavik','Reykjavík','Iceland'],['berlin','Berlin','Germany'],['vienna','Vienna','Austria'],['prague','Prague','Czechia'],['warsaw','Warsaw','Poland'],
  ['athens','Athens','Greece'],['budapest','Budapest','Hungary'],['bucharest','Bucharest','Romania'],['sofia','Sofia','Bulgaria'],['zagreb','Zagreb','Croatia'],
  ['tokyo','Tokyo','Japan'],['seoul','Seoul','South Korea'],['beijing','Beijing','China'],['bangkok','Bangkok','Thailand'],['hanoi','Hanoi','Vietnam'],
  ['manila','Manila','Philippines'],['jakarta','Jakarta','Indonesia'],['singapore','Singapore','Singapore'],['new-delhi','New Delhi','India'],['islamabad','Islamabad','Pakistan'],
  ['cairo','Cairo','Egypt'],['nairobi','Nairobi','Kenya'],['addis-ababa','Addis Ababa','Ethiopia'],['accra','Accra','Ghana'],['rabat','Rabat','Morocco'],
  ['ottawa','Ottawa','Canada'],['washington','Washington, D.C.','United States'],['mexico-city','Mexico City','Mexico'],['havana','Havana','Cuba'],['kingston','Kingston','Jamaica'],
  ['brasilia','Brasília','Brazil'],['buenos-aires','Buenos Aires','Argentina'],['santiago','Santiago','Chile'],['lima','Lima','Peru'],['bogota','Bogotá','Colombia'],
  ['canberra','Canberra','Australia'],['wellington','Wellington','New Zealand'],['suva','Suva','Fiji'],['port-moresby','Port Moresby','Papua New Guinea'],['apia','Apia','Samoa'],
].map(([slug, city, country]) => ({ slug, city, country }));

function makeCityPack(): TriviaQuestion[] {
  return CAPITALS.flatMap((fact, index) => {
    const countries = capitalAlternatives(index, (item) => item.country);
    const cities = capitalAlternatives(index, (item) => item.city);
    return [
      question('city', `${fact.slug}-country`, `${fact.city} is the capital of which country?`, countries, fact.country, `${fact.city} is the capital of ${fact.country}.`, ['geography','capital']),
      question('city', `${fact.slug}-capital`, `What is the capital of ${fact.country}?`, cities, fact.city, `${fact.city} is the capital of ${fact.country}.`, ['geography','capital']),
    ];
  });
}

function capitalAlternatives(index: number, pick: (fact: CapitalFact) => string): string[] {
  const values: string[] = [];
  for (let offset = 0; offset < CAPITALS.length && values.length < 4; offset += 1) {
    const value = pick(CAPITALS[(index + offset * 11) % CAPITALS.length]);
    if (!values.includes(value)) values.push(value);
  }
  return values;
}

export const CITY_TRIVIA_QUESTIONS = makeCityPack();

export function triviaQuestionsForPacks(packIds: ('film' | 'books' | 'city')[]): TriviaQuestion[] {
  return [
    ...(packIds.includes('film') ? FILM_TRIVIA_QUESTIONS : []),
    ...(packIds.includes('books') ? BOOK_TRIVIA_QUESTIONS : []),
    ...(packIds.includes('city') ? CITY_TRIVIA_QUESTIONS : []),
  ];
}

export function validateTriviaPack(questions: TriviaQuestion[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  for (const item of questions) {
    if (ids.has(item.id)) errors.push(`Duplicate question id: ${item.id}`);
    if (prompts.has(item.prompt)) errors.push(`Duplicate question prompt: ${item.prompt}`);
    if (item.choices.length !== 4) errors.push(`${item.id} must have four choices`);
    if (new Set(item.choices.map((choice) => choice.text)).size !== item.choices.length) errors.push(`${item.id} repeats an answer`);
    if (!item.choices.some((choice) => choice.id === item.correctChoiceId)) errors.push(`${item.id} has no valid correct answer`);
    ids.add(item.id);
    prompts.add(item.prompt);
  }
  return errors;
}

export function seededShuffle<T>(values: T[], seed: string): T[] {
  const result = [...values];
  let state = hash(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
