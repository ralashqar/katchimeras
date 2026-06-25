import type { DayVisionSummary } from '@/types/home';

// Detect whether food was part of the day from the on-device Apple Vision read
// (no pixels leave the phone — only the derived labels are inspected). Drives the
// Food Vault's primary trigger: "Vision detected food → offer to save it." It
// never auto-creates a memory; the user still gives the meaning.

// Specific foods → a friendly label + emoji to pre-fill the picker. Ordered most-
// specific first; the first hit wins. Kept broad on purpose so Apple Vision's
// concept labels (which lean generic, e.g. "baked goods", "fast food") still land.
const SPECIFIC: { re: RegExp; label: string; emoji: string }[] = [
  { re: /\b(coffee|espresso|latte|cappuccino|mocha|americano|flat white)\b/, label: 'Coffee', emoji: '☕' },
  { re: /\b(tea|matcha|chai)\b/, label: 'Tea', emoji: '🍵' },
  {
    re: /\b(cake|dessert|pastry|pastries|ice ?cream|gelato|donut|doughnut|cookie|biscuit|brownie|pie|croissant|muffin|cupcake|baked goods?|chocolate|candy|waffle)\b/,
    label: 'Dessert',
    emoji: '🍰',
  },
  { re: /\b(pizza)\b/, label: 'Pizza', emoji: '🍕' },
  { re: /\b(pasta|noodles?|spaghetti|ramen|lasagna|macaroni)\b/, label: 'Pasta', emoji: '🍝' },
  { re: /\b(burger|hamburger|cheeseburger|fries|french fries|hot ?dog|fast food)\b/, label: 'Burger', emoji: '🍔' },
  { re: /\b(sushi|sashimi|maki|nigiri|tempura)\b/, label: 'Sushi', emoji: '🍣' },
  { re: /\b(taco|burrito|quesadilla|nachos|enchilada)\b/, label: 'Tacos', emoji: '🌮' },
  { re: /\b(curry|tikka|masala|biryani|dal|naan)\b/, label: 'Curry', emoji: '🍛' },
  { re: /\b(salad|salads)\b/, label: 'Salad', emoji: '🥗' },
  { re: /\b(soup|broth|stew|ramen|pho)\b/, label: 'Soup', emoji: '🍲' },
  { re: /\b(sandwich|sandwiches|sub|panini|wrap|bagel|baguette)\b/, label: 'Sandwich', emoji: '🥪' },
  { re: /\b(steak|barbecue|bbq|grill|roast|chicken|beef|pork|lamb|kebab|skewer)\b/, label: 'Grill', emoji: '🍖' },
  { re: /\b(fish|seafood|shrimp|prawn|salmon|tuna|oyster|crab|lobster)\b/, label: 'Seafood', emoji: '🦐' },
  { re: /\b(rice|fried rice|risotto|paella)\b/, label: 'Rice', emoji: '🍚' },
  { re: /\b(wine|cocktail|beer|smoothie|juice|soda|lemonade|milkshake|champagne)\b/, label: 'Drink', emoji: '🥤' },
  { re: /\b(breakfast|brunch|pancakes?|toast|eggs?|omelette|bacon|cereal|porridge|oatmeal)\b/, label: 'Breakfast', emoji: '🍳' },
  { re: /\b(fruit|apple|banana|berries|strawberr|grapes?|orange|mango|melon)\b/, label: 'Fruit', emoji: '🍎' },
  { re: /\b(bread|loaf|sourdough|bun|roll)\b/, label: 'Bread', emoji: '🍞' },
  { re: /\b(cheese|charcuterie)\b/, label: 'Cheese', emoji: '🧀' },
];

// Generic "this is food" terms (no specific label).
const GENERIC = [
  'food',
  'meal',
  'dish',
  'cuisine',
  'restaurant',
  'cafe',
  'café',
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

export type FoodDetection = { detected: boolean; label?: string; emoji?: string };

// Core matcher — `haystack` must be lower-cased and space-padded on both ends.
function matchFood(haystack: string): FoodDetection {
  for (const food of SPECIFIC) {
    if (food.re.test(haystack)) return { detected: true, label: food.label, emoji: food.emoji };
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

// Detect food mentioned in free text — a written/voice note's transcript. Same
// vocabulary as the vision read, so "grabbed a coffee with mum" → Coffee.
export function detectFoodInText(text: string | undefined | null): FoodDetection {
  if (!text || !text.trim()) return { detected: false };
  return matchFood(` ${text.toLowerCase()} `);
}
