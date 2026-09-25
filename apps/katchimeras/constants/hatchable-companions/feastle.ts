import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';

/** Feastle's first playable pass. Authored data, consumed by the shared hatchable runtime. */
export const FEASTLE_HATCHABLE: HatchableCompanionDefinition = {
  "companion": "feastle",
  "displayName": "Feastle",
  "tile": {
    "id": "feastle-home",
    "coord": {
      "q": 0,
      "r": -1
    },
    "unlockId": "feastle:arrival",
    "price": 60,
    "name": "A warm table",
    "revealPreset": "mist-clear",
    "alphaBoundsKey": "feastle_hearth_v1_hex_tile.webp",
    "markerLines": {
      "sleeping": "The old lantern path leads to a warm table. A spoon taps against a bowl."
    }
  },
  // Cozy 4X: the warm table wakes once Petalimp is home (Chapter 4, The Kitchen); Feastle brings the Hearth Pantry.
  "availability": {
    "kind": "island_friend_home",
    "residentSkinId": "petalimp"
  },
  "discovery": {
    "gateId": "gate-3-first-choice",
    "pathId": "warm-table"
  },
  "mission": {
    "id": "mission:feastle",
    "storageKey": "katchimeras.mist-mission.feastle.v1",
    "required": 8,
    "camera": {
      "kind": "focus_target",
      "target": {
        "kind": "haven_gateway"
      },
      "zoom": 0.96,
      "anchorY": 0.36,
      "durationMs": 900
    },
    "seed": {
      "items": [
        {
          "cell": 40,
          "definitionId": "food:table:1"
        },
        {
          "cell": 39,
          "definitionId": "food:table:1"
        },
        {
          "cell": 36,
          "definitionId": "food:table:1"
        }
      ],
      "echoes": [
        {
          "cell": 38,
          "id": "feastle-pantry-1",
          "definitionId": "food:table:2"
        }
      ],
      "veiled": [
        {
          "cell": 31,
          "id": "feastle-pantry-2",
          "definitionId": "food:table:3"
        },
        {
          "cell": 24,
          "id": "feastle-pantry-3",
          "definitionId": "food:table:5"
        },
        {
          "cell": 32,
          "id": "feastle-pantry-4",
          "definitionId": "food:table:1"
        },
        {
          "cell": 25,
          "id": "feastle-pantry-5",
          "definitionId": "food:table:2"
        },
        {
          "cell": 26,
          "id": "feastle-pantry-6",
          "definitionId": "food:table:3"
        }
      ]
    },
    "guides": {
      "firstMerge": {
        "eyebrow": "Left by the hearth",
        "title": "Two Ingredients. A small beginning.",
        "body": "Merge them into a Snack. Each merge pushes back a wisp."
      },
      "wake": {
        "eyebrow": "Under the Mist",
        "title": "Something needs {a} {name}.",
        "body": "Give it its match to wake it."
      },
      "merge": {
        "eyebrow": "Two of a kind",
        "title": "Make {a} {name}.",
        "body": "Drag matching items together."
      },
      "mergeFallbackTitle": "Two of the same make the next one up.",
      "free": {
        "eyebrow": "Keep going",
        "title": "Push back the Mist.",
        "body": "Every merge brings our friend closer."
      }
    },
    "wisps": [
      {
        "id": "wisp-left",
        "fx": 0.26,
        "fy": 0.34,
        "size": 0.19
      },
      {
        "id": "wisp-top",
        "fx": 0.46,
        "fy": 0.1,
        "size": 0.17
      },
      {
        "id": "wisp-right",
        "fx": 0.74,
        "fy": 0.24,
        "size": 0.2
      },
      {
        "id": "wisp-low",
        "fx": 0.56,
        "fy": 0.46,
        "size": 0.18
      }
    ],
    "lines": {
      "firstStrike": "A spoon taps back. Someone heard that.",
      "fell": [
        "A basket appears where the Mist was.",
        "Warm air slips between the stones.",
        "One wisp left. The table is still set."
      ],
      "last": "The last wisp loosens. An Egg has been keeping the hearth warm.",
      "reveal": "Something for the next course was hidden there."
    },
    "barTitle": "Bring warmth back"
  },
  "discoveryFlow": {
    "id": "glow-feastle-discovery",
    // v2: no Egg; Feastle is rescued straight home once the table is revealed.
    "version": 2,
    "runId": "story:glow-feastle-v1",
    "migrations": { "gateway.egg": "gateway.rescue", "egg.enter": "gateway.rescue" },
    "arrival": "rescue",
    "joined": {
      "guide": {
        "eyebrow": "Feastle has joined your Sanctuary",
        "title": "Someone saved you a seat.",
        "body": "Feastle kept the hearth warm the whole time. Now the Caf\u00e9 is a Kitchen: proper dishes, desserts, and feasts that feed the whole team."
      },
      "actionLabel": "Pull up a chair"
    },
    "egg": {
      "guide": {
        "eyebrow": "A place kept warm",
        "title": "Someone saved you a seat.",
        "body": "The hearth has been quiet for a long time. Tell the Egg what a little meal can mean."
      },
      "actionLabel": "Meet the Egg"
    }
  },
  "dayOne": {
    "flow": {
      "id": "feastle-day-one",
      "version": 1,
      "runId": "journey:feastle:day-1",
      "title": "A Seat Kept Warm"
    },
    "conversationId": "feastle:journey:day-one",
    "opening": "A lantern path? It used to bring friends from all around Heartwood to this table. I am Feastle. I kept setting two places. What shall we share first?",
    "choices": [
      {
        "id": "simple",
        "label": "Something simple"
      },
      {
        "id": "share",
        "label": "Something we can share"
      },
      {
        "id": "try",
        "label": "Something I have never tried"
      }
    ],
    "handoffs": {
      "simple": "Simple is a proper recipe. Two ingredients, a little time. I saved a pantry parcel for us.",
      "share": "Then I will fetch another bowl. There is a pantry parcel waiting for our Garden.",
      "try": "A tiny adventure, served warm. Let us open the pantry parcel and see what begins."
    },
    "endMessage": "The Hearth Pantry is waiting in the Garden. We can start with one Snack.",
    "choiceVariable": "firstMeal",
    "handoffLabel": "Open our pantry",
    "parcel": {
      "generatorId": "hearth-pantry",
      "rewardId": "journey:feastle:day-1:hearth-pantry"
    }
  },
  "lesson": {
    "flow": {
      "id": "feastle-garden-lesson",
      "version": 1,
      "runId": "ftue:feastle-garden:1"
    },
    "taskCapability": "feastle.garden.task",
    "eventPrefix": "feastle.garden",
    "closing": "A Snack, a warm hearth, and a place for whoever finds our signal. Mossprout has the roots. Steppling has the path. I’ll keep the welcome ready.",
    "summary": "A welcoming hearth beneath Heartwood",
    "generatorId": "hearth-pantry",
    "parcelArrivalId": "journey:feastle:day-1:hearth-pantry",
    "growDefinitionId": "food:table:2",
    "dropDefinitionId": "food:table:1",
    "order": {
      "id": "feastle:discovery:first-snack",
      "characterId": "feastle",
      "title": "Our first Snack",
      "description": "Merge two Ingredients from the Hearth Pantry, then serve a Snack to Feastle.",
      "difficulty": "small",
      "requirements": [
        {
          "definitionId": "food:table:2",
          "quantity": 1
        }
      ],
      "reward": {
        "coins": 20,
        "mergeXp": 18,
        "friendshipXp": 12,
        "energy": 2
      },
      "signature": false,
      "purpose": "normal",
      "storyArcId": "feastle:discovery"
    },
    "copy": {
      "parcel": {
        "eyebrow": "A gift from Feastle",
        "title": "The Hearth Pantry.",
        "body": "A few things I kept dry. Tap the parcel to unpack them."
      },
      "room": {
        "eyebrow": "A little room",
        "title": "Make a space.",
        "body": "Merge or store an item to continue."
      },
      "grow": {
        "eyebrow": "Our first recipe",
        "title": "Two Ingredients make a Snack.",
        "body": "Take Ingredients from the Hearth Pantry, then merge them."
      },
      "serve": {
        "eyebrow": "A seat for you",
        "title": "Serve our first Snack.",
        "body": "Our lantern should lead to a welcome. Begin with one Snack for this hearth."
      },
      "finale": {
        "eyebrow": "Together",
        "title": "Back to Feastle.",
        "body": ""
      },
      "finaleAction": "Prepare our first signal"
    }
  },
  "egg": {
    "accentColor": "#E6A04B",
    "guides": {
      "intent": {
        "eyebrow": "The quiet hearth",
        "title": "A little warmth reaches the shell.",
        "body": ""
      },
      "reading": {
        "eyebrow": "The quiet hearth",
        "title": "There is no recipe for belonging.",
        "body": ""
      },
      "feed": {
        "eyebrow": "The quiet hearth",
        "title": "Any small meal can be a beginning.",
        "body": ""
      },
      "permission": {
        "eyebrow": "The quiet hearth",
        "title": "You can tell this Egg in your own way.",
        "body": ""
      },
      "alternative": {
        "eyebrow": "The quiet hearth",
        "title": "A seat does not have to be earned.",
        "body": ""
      },
      "ready": {
        "eyebrow": "The quiet hearth",
        "title": "Someone inside is setting out another bowl.",
        "body": ""
      }
    },
    "intent": {
      "actionId": "egg.feastle.intent",
      "title": "What makes a little meal feel like home?",
      "bond": 10,
      "options": [
        {
          "id": "familiar",
          "label": "A familiar taste"
        },
        {
          "id": "company",
          "label": "Someone to share it with"
        },
        {
          "id": "quiet",
          "label": "Time to enjoy it quietly"
        }
      ]
    },
    "alternative": {
      "actionId": "egg.feastle.meal",
      "title": "What would you bring to a table in the Mist?",
      "bond": 20,
      "options": [
        {
          "id": "bread",
          "label": "Something simple, like bread"
        },
        {
          "id": "warm",
          "label": "A warm bowl"
        },
        {
          "id": "fruit",
          "label": "A piece of fruit"
        },
        {
          "id": "company",
          "label": "Just myself, today"
        }
      ]
    },
    "feed": {
      "kind": "answer"
    },
    "hatch": {
      "actionId": "egg.feastle.hatch",
      "title": "Hatch",
      "description": "Your little friend is ready."
    }
  },
  "economy": {
    "generatorId": "hearth-pantry"
  },
  "daily": {
    "chapterTitle": "The Table We Remember",
    "gardenActionLabel": "Prepare a feast",
    "restingLine": "Feastle is letting the dough rest. The Garden and our daily moments are still here.",
    "idleLine": "The hearth is warm. Show me a little of your day, or stay for a question.",
    "questionSubtitle": "A tiny story from around the table.",
    "presentation": "rows",
    "polls": [
      {
        "id": "last-roll",
        "title": "The last roll",
        "prompt": "There is one warm roll left and two friends at the table. What happens?",
        "labels": [
          "We split it",
          "I offer it",
          "We make another",
          "We ask who wants it"
        ],
        "replies": [
          "Two smaller pieces. Still warm.",
          "A kind offer, with room for an honest answer.",
          "The oven likes a second chance.",
          "Asking saves a surprising amount of guessing."
        ],
        "ending": "The hearth keeps room for different answers."
      },
      {
        "id": "old-recipe",
        "title": "The folded recipe",
        "prompt": "A recipe has a faded line. How would you finish the dish?",
        "labels": [
          "Try what feels right",
          "Ask someone",
          "Make a simpler version",
          "Keep the recipe for later"
        ],
        "replies": [
          "A little invention belongs in the margin.",
          "Recipes can be conversations.",
          "The simpler version still feeds someone.",
          "Paper is patient."
        ],
        "ending": "The hearth keeps room for different answers."
      },
      {
        "id": "unexpected-guest",
        "title": "One more seat",
        "prompt": "Someone arrives just as supper is ready. What do you reach for?",
        "labels": [
          "Another bowl",
          "The bread basket",
          "A chair",
          "A friendly hello"
        ],
        "replies": [
          "The cupboard has one waiting.",
          "A basket makes its own kind of welcome.",
          "Space first. A good beginning.",
          "Sometimes that is the thing they came for."
        ],
        "ending": "The hearth keeps room for different answers."
      },
      {
        "id": "rainy-table",
        "title": "Rain at the door",
        "prompt": "Rain begins while the pot is warming. What belongs beside it?",
        "labels": [
          "A story",
          "A quiet moment",
          "A small task",
          "Good company"
        ],
        "replies": [
          "I have one about a spoon that travelled farther than I did.",
          "We can listen to the roof.",
          "The spoons need sorting, if you like.",
          "There is room on the bench."
        ],
        "ending": "The hearth keeps room for different answers."
      },
      {
        "id": "new-flavour",
        "title": "A curious flavour",
        "prompt": "A friend brings something you have never tasted. What would you do?",
        "labels": [
          "Ask about it",
          "Try a little",
          "Stick with my familiar food",
          "Save it for another time"
        ],
        "replies": [
          "The story is part of the offering.",
          "A little is plenty for an adventure.",
          "Familiar belongs here too.",
          "An invitation can wait."
        ],
        "ending": "The hearth keeps room for different answers."
      },
      {
        "id": "borrowed-spoon",
        "title": "The borrowed spoon",
        "prompt": "A neighbour returns a spoon with a little ribbon around it. What do you notice first?",
        "labels": [
          "The ribbon",
          "That they remembered",
          "The spoon’s journey"
        ],
        "replies": [
          "A small extra kindness.",
          "Being remembered can feel very warm.",
          "A spoon with somewhere to have been."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "market-morning",
        "title": "Market morning",
        "prompt": "You have time to visit one stall before the rain. Which catches you?",
        "labels": [
          "The familiar one",
          "The brightest colours",
          "A new little stall"
        ],
        "replies": [
          "Someone there might know your name.",
          "A basket full of colour changes a grey morning.",
          "Every familiar place was new once."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "crooked-biscuit",
        "title": "The crooked biscuit",
        "prompt": "One biscuit comes out shaped like a cloud. What would you do?",
        "labels": [
          "Keep it for myself",
          "Show someone",
          "Give it a name"
        ],
        "replies": [
          "A private little cloud.",
          "They may see a different shape.",
          "Then it has become a character."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "empty-notebook",
        "title": "A blank page",
        "prompt": "Feastle opens his recipe notebook to an empty page. What goes first?",
        "labels": [
          "A title",
          "A memory",
          "A tiny sketch"
        ],
        "replies": [
          "A name makes a beginning easier to find.",
          "That is the part I do not want to lose.",
          "A picture can be a recipe too."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "bench-space",
        "title": "The long bench",
        "prompt": "There is a sunny end and a shady end of the bench. Where do you settle?",
        "labels": [
          "In the sunshine",
          "In the shade",
          "Beside a friend"
        ],
        "replies": [
          "I will put the bowl where you can reach it.",
          "Cool and quiet. A good corner.",
          "Then I will slide along."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "almost-supper",
        "title": "Almost supper",
        "prompt": "Supper is nearly ready, and there is a little time left. What would you choose?",
        "labels": [
          "Set the table",
          "Sit for a moment",
          "Ask if help is needed"
        ],
        "replies": [
          "The bowls make it feel real.",
          "The waiting can be part of the rest.",
          "A question leaves room for an answer."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "herb-pot",
        "title": "The herb pot",
        "prompt": "A tiny herb has grown between two hearth stones. What now?",
        "labels": [
          "Find it a pot",
          "Let it keep its place",
          "Ask Mossprout"
        ],
        "replies": [
          "A home with a little room to grow.",
          "It chose an interesting neighbourhood.",
          "Mossprout does know the green things."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "favourite-bowl",
        "title": "The favourite bowl",
        "prompt": "A favourite bowl has a small chip. What makes you keep it?",
        "labels": [
          "Its memories",
          "How it fits my hands",
          "I might choose another"
        ],
        "replies": [
          "Some things carry more than supper.",
          "A familiar weight can be comforting.",
          "A new bowl can have a story too."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "distant-scent",
        "title": "Something familiar",
        "prompt": "A smell at the door reminds you of somewhere. What do you follow?",
        "labels": [
          "The memory",
          "The smell",
          "My curiosity later"
        ],
        "replies": [
          "Places can travel that way.",
          "The trail might lead to a kitchen.",
          "No need to chase every little clue."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "picnic-plan",
        "title": "A small picnic",
        "prompt": "There is room for one extra thing in the picnic basket. What fits?",
        "labels": [
          "A cloth to sit on",
          "A book",
          "Something to share"
        ],
        "replies": [
          "A little comfort wherever we stop.",
          "A story for after the crumbs.",
          "I will bring an extra bowl."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "quiet-guest",
        "title": "The quiet guest",
        "prompt": "A friend sits at the table without saying much. What feels right?",
        "labels": [
          "Keep them company",
          "Offer a simple question",
          "Let them be quiet"
        ],
        "replies": [
          "Together does not have to be noisy.",
          "A gentle question can open a door.",
          "Then we can listen to the fire."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "first-attempt",
        "title": "A first attempt",
        "prompt": "You try a recipe and it comes out differently than expected. What next?",
        "labels": [
          "Give it another name",
          "Try again someday",
          "Ask what happened"
        ],
        "replies": [
          "Perhaps it wanted to be something else.",
          "The notebook has plenty of pages.",
          "Curiosity belongs in the kitchen."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "small-celebration",
        "title": "A small celebration",
        "prompt": "Something went well today. How would the hearth mark it?",
        "labels": [
          "A little toast",
          "Tell one friend",
          "Keep the feeling quietly"
        ],
        "replies": [
          "To a small good thing.",
          "Good news can fit in a short sentence.",
          "It still counts when it is just yours."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "saved-seat",
        "title": "A seat saved",
        "prompt": "You arrive late and find a seat waiting. What would you hope to hear?",
        "labels": [
          "Glad you came",
          "Take your time",
          "Tell us about your day"
        ],
        "replies": [
          "That is what I would say first.",
          "There is no hurry in this bowl.",
          "And there is room for the short version."
        ],
        "ending": "Another little story for the hearth."
      },
      {
        "id": "tomorrows-table",
        "title": "Tomorrow’s table",
        "prompt": "Before the hearth goes quiet, what would you leave ready for tomorrow?",
        "labels": [
          "A clean bowl",
          "A little note",
          "Nothing just yet"
        ],
        "replies": [
          "A small welcome for whoever arrives.",
          "A few words can keep a place warm.",
          "Tomorrow can begin tomorrow."
        ],
        "ending": "Another little story for the hearth."
      }
    ],
    "photo": {
      "category": "food",
      "title": "Show Feastle a little food",
      "subtitle": "A meal, snack or ingredient. Simple counts.",
      "artKey": "today:photo",
      "camera": {
        "icon": "fork.knife",
        "title": "A little food, for Feastle",
        "subtitle": "Homemade, bought or a single ingredient.",
        "permissionTitle": "Show Feastle something from your table",
        "permissionBody": "Use the camera to share a meal, snack or ingredient. You can skip this and choose another activity.",
        "analysingLine": "Looking for what is on the table…"
      },
      "match": {
        "categoryIds": [
          "food"
        ]
      },
      "lines": {
        "noMatch": "I could not make out the food in that one. A closer look might help, or we can just talk.",
        "thanks": [
          "A little piece of your day. I am glad you brought it.",
          "That belongs at our table too.",
          "You do not need a special meal to have a story.",
          "Noted in the little book beside the hearth."
        ]
      }
    }
  }
};
