import type { CuisineFamily, DayVisionSummary } from '@/types/home';

// Detect whether food was part of the day from on-device labels, OCR, or note
// text. The detector returns both a friendly food label and, when reliable, a
// cuisine family so cuisine quests can be satisfied from photos or notes.

const SPECIFIC: { re: RegExp; label: string; emoji: string; cuisine?: CuisineFamily }[] = [
  { re: /\b(coffee|espresso|latte|cappuccino|mocha|americano|flat white)\b/, label: 'Coffee', emoji: 'coffee' },
  { re: /\b(tea|matcha|chai)\b/, label: 'Tea', emoji: 'tea' },
  {
    re: /\b(cake|dessert|pastry|pastries|ice ?cream|gelato|donut|doughnut|cookie|biscuit|brownie|pie|croissant|muffin|cupcake|baked goods?|chocolate|candy|waffle)\b/,
    label: 'Dessert',
    emoji: 'dessert',
  },
  { re: /\b(sushi|sashimi|maki|nigiri|tempura)\b/, label: 'Sushi', emoji: 'sushi', cuisine: 'japanese' },
  { re: /\b(ramen|udon|soba|takoyaki|okonomiyaki|yakitori)\b/, label: 'Ramen', emoji: 'ramen', cuisine: 'japanese' },
  { re: /\b(pizza)\b/, label: 'Pizza', emoji: 'pizza', cuisine: 'italian' },
  { re: /\b(pasta|noodles?|spaghetti|lasagna|macaroni)\b/, label: 'Pasta', emoji: 'pasta', cuisine: 'italian' },
  { re: /\b(burger|hamburger|cheeseburger|fries|french fries|hot ?dog|fast food)\b/, label: 'Burger', emoji: 'burger' },
  { re: /\b(taco|burrito|quesadilla|nachos|enchilada)\b/, label: 'Tacos', emoji: 'taco', cuisine: 'mexican' },
  { re: /\b(curry|tikka|masala|biryani|dal|naan)\b/, label: 'Curry', emoji: 'curry', cuisine: 'indian' },
  { re: /\b(hummus|falafel|shawarma|kebab|pita|tabbouleh)\b/, label: 'Middle Eastern', emoji: 'meal', cuisine: 'middle_eastern' },
  { re: /\b(dim sum|dumplings?|bao|noodles?|wonton|hot ?pot|peking duck)\b/, label: 'Chinese food', emoji: 'meal', cuisine: 'chinese' },
  { re: /\b(crepe|croissant|baguette|quiche|ratatouille|macaron)\b/, label: 'French food', emoji: 'meal', cuisine: 'french' },
  { re: /\b(gyro|gyros|souvlaki|moussaka|tzatziki|greek salad)\b/, label: 'Greek food', emoji: 'meal', cuisine: 'greek' },
  { re: /\b(salad|salads)\b/, label: 'Salad', emoji: 'salad' },
  { re: /\b(soup|broth|stew|pho)\b/, label: 'Soup', emoji: 'soup' },
  { re: /\b(sandwich|sandwiches|sub|panini|wrap|bagel|baguette)\b/, label: 'Sandwich', emoji: 'sandwich' },
  { re: /\b(steak|barbecue|bbq|grill|roast|chicken|beef|pork|lamb|skewer)\b/, label: 'Grill', emoji: 'grill' },
  { re: /\b(fish|seafood|shrimp|prawn|salmon|tuna|oyster|crab|lobster)\b/, label: 'Seafood', emoji: 'seafood' },
  { re: /\b(rice|fried rice|risotto|paella)\b/, label: 'Rice', emoji: 'rice' },
  { re: /\b(wine|cocktail|beer|smoothie|juice|soda|lemonade|milkshake|champagne)\b/, label: 'Drink', emoji: 'drink' },
  { re: /\b(breakfast|brunch|pancakes?|toast|eggs?|omelette|bacon|cereal|porridge|oatmeal)\b/, label: 'Breakfast', emoji: 'breakfast' },
  { re: /\b(fruit|apple|banana|berries|strawberr|grapes?|orange|mango|melon)\b/, label: 'Fruit', emoji: 'fruit' },
  { re: /\b(bread|loaf|sourdough|bun|roll)\b/, label: 'Bread', emoji: 'bread' },
  { re: /\b(cheese|charcuterie)\b/, label: 'Cheese', emoji: 'cheese' },
];

const GENERIC = [
  'food',
  'meal',
  'dish',
  'cuisine',
  'restaurant',
  'cafe',
  'cafe',
  'bistro',
  'diner',
  'plate',
  'bowl',
  'dining',
  'bakery',
  'vegetable',
  'snack',
  'lunch',
  'dinner',
  'supper',
  'drink',
  'beverage',
  'tableware',
  'cutlery',
  'recipe',
  'cooking',
  'delicious',
  'tasty',
  'ate ',
  'eating',
];

export type FoodDetection = { detected: boolean; label?: string; emoji?: string; cuisine?: CuisineFamily | null };

function matchFood(haystack: string): FoodDetection {
  for (const food of SPECIFIC) {
    if (food.re.test(haystack)) {
      return { detected: true, label: food.label, emoji: food.emoji, cuisine: food.cuisine ?? null };
    }
  }
  if (GENERIC.some((keyword) => haystack.includes(keyword))) return { detected: true };
  return { detected: false };
}

export function detectFoodInVision(vision: DayVisionSummary | undefined | null): FoodDetection {
  if (!vision) return { detected: false };
  const terms = [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
    ...(vision.textTokens ?? []),
  ]
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.toLowerCase());
  return matchFood(` ${terms.join(' ')} `);
}

export function detectFoodInText(text: string | undefined | null): FoodDetection {
  if (!text || !text.trim()) return { detected: false };
  return matchFood(` ${text.toLowerCase()} `);
}
